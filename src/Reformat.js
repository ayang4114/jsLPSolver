/*global describe*/
/*global require*/
/*global module*/
/*global it*/
/*global console*/
/*global process*/
/*jshint -W083 */

const REGEX = {
    rxo: {
        /* jshint ignore:start */
        is_blank: /^\W{0,}$/,
        is_objective: /(max|min)(imize){0,}[^\n]*\:/i,
        //previous version
        //"is_int": /^\W{0,}int/i,
        //new version to avoid comments
        is_int: /^(?!\/\*)\W{0,}int\s{1,}/i,
        is_bin: /^(?!\/\*)\W{0,}bin\s{1,}/i,
        is_constraint: /(\>|\<){0,}\=/i,
        is_unrestricted: /^\S{0,}unrestricted/i,

        // Fixed to prevent (+ or -) from being attached to variable names.
        "parse_lhs": /(.*\:|(\-|\+){0,1}\s{0,}\d{0,}\.{0,1}\d{0,}\s{0,}[a-zA-Z])/gi,
        "parse_rhs": /(\-|\+){0,1}\d{1,}\.{0,}\d{0,}\W{0,}\;{0,1}$/i,
        "parse_dir": /(\>|\<){0,}\=/gi,
        "parse_int": /[^\s|^\,]+/gi,
        "parse_bin": /[^\s|^\,]+/gi,
        "get_num": /(\-|\+){0,1}(\W|^)\d+\.{0,1}\d{0,}/g, // Why accepting character \W before the first digit?
        "get_word": /[A-Za-z].*/
        /* jshint ignore:end */
    }
}

function parseObjective(input, model) {
    // Set up in model the opType
    model.opType = input.match(/(max|min)/gi)[0];
    // Pull apart lhs
    const rxo = REGEX.rxo
    const ary = input.match(rxo.parse_lhs).map(function (d) {
        return d.replace(/\s+/, "");
    }).slice(1);

    // *** STEP 1 *** ///
    // Get the variables out
    ary.forEach(function (d) {
        // Get the number if it's there. This is fine.
        hldr = d.match(rxo.get_num);
        // If it isn't a number, it might
        // be a standalone variable
        if (hldr === null) {
            hldr = d[0] === '-' ? -1 : 1
        } else {
            hldr = hldr[0];
        }
        hldr = parseFloat(hldr);

        // Get the variable name
        hldr2 = d.match(rxo.get_word)[0].replace(/\;$/, "");

        // Make sure the variable is in the model
        model.variables[hldr2] = model.variables[hldr2] || {};
        model.variables[hldr2]._obj = hldr;
    });
    return model
}

function parseIntegerStatement(line, model) {
    // Get the array of ints
    const ary = line.match(REGEX.rxo.parse_int).slice(1);

    // Since we have an int, our model should too
    model.ints = model.ints || {};

    ary.forEach(function (d) {
        d = d.replace(";", "");
        model.ints[d] = 1;
    });
    return model
}

function parseBinaryStatement(line, model) {
    // Get the array of bins
    const ary = line.match(rxo.parse_bin).slice(1);

    // Since we have an binary, our model should too
    model.binaries = model.binaries || {};

    ary.forEach(function (d) {
        d = d.replace(";", "");
        model.binaries[d] = 1;
    });
}

/* 
 * Helper Functions.
 * 
 */
function parseArray(rxo, constraints, input) {
    var model = {
        "opType": "",
        "optimize": "_obj",
        "constraints": {},
        "variables": {}
    }, ary = null, hldr = "", hldr2 = "",
        constraint = "", rhs = 0;
    for (var i = 0; i < input.length; i++) {
        constraint = "_" + i;
        // Get the string we're working with
        // Check why currentLine is mutable.
        let currentLine = input[i];

        // Reset the array
        ary = null;

        // Test to see if we're the objective
        if (rxo.is_objective.test(currentLine)) {
            model = parseObjective(currentLine, model)
        } else if (rxo.is_int.test(currentLine)) {
            model = parseIntegerStatement(currentLine, model)
        } else if (rxo.is_bin.test(currentLine)) {
            model = parseBinaryStatement(currentLine, model)
        } else if (rxo.is_constraint.test(currentLine)) {
            var separatorIndex = currentLine.indexOf(":");
            var constraintExpression = (separatorIndex === -1) ? currentLine : currentLine.slice(separatorIndex + 1);

            // Pull apart lhs
            ary = constraintExpression.match(rxo.parse_lhs).map(function (d) {
                return d.replace(/\s+/, "");
            });

            // *** STEP 1 *** ///
            // Get the variables out
            ary.forEach(function (d) {
                // Get the number if its there
                hldr = d.match(rxo.get_num);

                if (hldr === null) {
                    if (d.substr(0, 1) === "-") {
                        hldr = -1;
                    } else {
                        hldr = 1;
                    }
                } else {
                    hldr = hldr[0];
                }

                hldr = parseFloat(hldr);


                // Get the variable name
                hldr2 = d.match(rxo.get_word)[0];

                // Make sure the variable is in the model
                model.variables[hldr2] = model.variables[hldr2] || {};
                model.variables[hldr2][constraint] = hldr;

            });

            // *** STEP 2 *** ///
            // Get the RHS out
            rhs = parseFloat(currentLine.match(rxo.parse_rhs)[0]);

            // *** STEP 3 *** ///
            // Get the Constrainer out
            currentLine = constraints[currentLine.match(rxo.parse_dir)[0]];
            model.constraints[constraint] = model.constraints[constraint] || {};
            model.constraints[constraint][currentLine] = rhs;
            ////////////////////////////////////
        } else if (rxo.is_unrestricted.test(currentLine)) {
            // Get the array of unrestricted
            ary = currentLine.match(rxo.parse_int).slice(1);

            // Since we have an int, our model should too
            model.unrestricted = model.unrestricted || {};

            ary.forEach(function (d) {
                d = d.replace(";", "");
                model.unrestricted[d] = 1;
            });
        }
    }
    return model
}



/*************************************************************
* Method: to_JSON
* Scope: Public:
* Agruments: input: Whatever the user gives us
* Purpose: Convert an unfriendly formatted LP
*          into something that our library can
*          work with
**************************************************************/
function to_JSON(input) {
    var rxo = REGEX.rxo,
        constraints = {
            ">=": "min",
            "<=": "max",
            "=": "equal"
        }

    // Handle input if its coming
    // to us as a hard string
    // instead of as an array of
    // strings
    if (typeof input === "string") {
        let splits = []
        input = input.split('\n');
        input = input.map(e => {
            splits.push(...e.split(';'))
        })
        input = splits
    }

    // Start iterating over the rows
    // to see what all we have
    return parseArray(rxo, constraints, input);
}


/*************************************************************
* Method: from_JSON
* Scope: Public:
* Agruments: model: The model we want solver to operate on
* Purpose: Convert a friendly JSON model into a model for a
*          real solving library...in this case
*          lp_solver
**************************************************************/
function from_JSON(model) {
    // Make sure we at least have a model
    if (!model) {
        throw new Error("Solver requires a model to operate on");
    }

    var output = "",
        ary = [],
        norm = 1,
        lookup = {
            "max": "<=",
            "min": ">=",
            "equal": "="
        },
        rxClean = new RegExp("[^A-Za-z0-9]+", "gi");

    // Build the objective statement
    output += model.opType + ":";

    // Iterate over the variables
    for (var x in model.variables) {
        // Give each variable a self of 1 unless
        // it exists already
        model.variables[x][x] = model.variables[x][x] ? model.variables[x][x] : 1;

        // Does our objective exist here?
        if (model.variables[x][model.optimize]) {
            output += " " + model.variables[x][model.optimize] + " " + x.replace(rxClean, "_");
        }
    }

    // Add some closure to our line thing
    output += ";\n";

    // And now... to iterate over the constraints
    for (x in model.constraints) {
        for (var y in model.constraints[x]) {
            for (var z in model.variables) {
                // Does our Constraint exist here?
                if (model.variables[z][x]) {
                    output += " " + model.variables[z][x] + " " + z.replace(rxClean, "_");
                }
            }
            // Add the constraint type and value...
            output += " " + lookup[y] + " " + model.constraints[x][y];
            output += ";\n";
        }
    }

    // Are there any ints?
    if (model.ints) {
        output += "\n\n";
        for (x in model.ints) {
            output += "int " + x.replace(rxClean, "_") + ";\n";
        }
    }

    // Are there any unrestricted?
    if (model.unrestricted) {
        output += "\n\n";
        for (x in model.unrestricted) {
            output += "unrestricted " + x.replace(rxClean, "_") + ";\n";
        }
    }

    // And kick the string back
    return output;
}

module.exports = {
    to_JSON: model => to_JSON(model),
    parseArray,
    REGEX,
    parseObjective
}

// module.exports = function (model) {
//     // If the user is giving us an array
//     // or a string, convert it to a JSON Model
//     // otherwise, spit it out as a string
//     if (model.length) {
//         return to_JSON(model);
//     } else {
//         return from_JSON(model);
//     }
// };
