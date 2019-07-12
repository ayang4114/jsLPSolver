/*global describe*/
/*global require*/
/*global module*/
/*global it*/
/*global console*/
/*global process*/
/*jshint -W083 */

const INT = 'int'
const BIN = 'bin'
const UNRESTRICTED = 'unrestricted'
const REGEX = {
    /* jshint ignore:start */
    is_blank: s => (/^\W{0,}$/).test(s),
    is_int: s => (/^(?!\/\*)\W{0,}int\s{1,}/i).test(s),
    is_bin: s => (/^(?!\/\*)\W{0,}bin\s{1,}/i).test(s),
    is_unrestricted: s => (/^\s{0,}unrestricted\s{1,}/i).test(s),
    is_objective: s => (/(max|min)(imize){0,}[^\n]*\:/i).test(s),
    is_constraint: s => (/(\>|\<){0,}\=/i).test(s),

    // Fixed to prevent (+ or -) from being attached to variable names.
    parse_lhs: s => {
        let arr = s.match(/(.*\:|(\-|\+){0,1}\s{0,}\d{0,}\.{0,1}\d{0,}\s{0,}[a-zA-Z])/gi)
        arr = arr.map(d => d.replace(/\s+/, ""))
        return arr
    },
    parse_rhs: s => {
        const value = s.match(/(\-|\+){0,1}\d{1,}\.{0,}\d{0,}\W{0,}\;{0,1}$/i)[0]
        return parseFloat(value)
    },
    parse_dir: s => s.match(/(\>|\<){0,}\=/gi)[0],
    // parse_int: s => s.match(/[^\s|^\,]+/gi),
    parse_num: s => s.match(/[^\s|^\,]+/gi),
    get_num: d => {
        let num = d.match(/(\-|\+){0,1}(\W|^)\d+\.{0,1}\d{0,}/g)

        // If it isn't a number, it might
        // be a standalone variable
        if (num === null) {
            num = d[0] === '-' ? -1 : 1
        } else {
            num = num[0];
        }
        return parseFloat(num)
    }, // Why accepting character \W before the first digit?
    get_word: d => d.match(/[A-Za-z].*/)[0]
    /* jshint ignore:end */
}

function parseObjective(input, model) {
    // Set up in model the opType
    model.opType = input.match(/(max|min)/gi)[0];
    // Pull apart lhs
    const ary = REGEX.parse_lhs(input).slice(1);

    // *** STEP 1 *** ///
    // Get the variables out
    ary.forEach(function (d) {
        // Get the number if it's there. This is fine.
        hldr = REGEX.get_num(d)

        // Get the variable name
        hldr2 = REGEX.get_word(d).replace(/\;$/, "");

        // Make sure the variable is in the model
        model.variables[hldr2] = model.variables[hldr2] || {};
        model.variables[hldr2]._obj = hldr;
    });
    return model
}

function parseTypeStatement(line, model, type) {
    const ary = REGEX.parse_num(line).slice(1);
    let attribute
    switch (type) {
        case INT:
            attribute = 'ints'
            break
        case BIN:
            attribute = 'binaries'
            break
        case UNRESTRICTED:
            attribute = 'unrestricted'
            break
        default:
            console.log('Error in parseTypeStatement')
            return
    }

    model[attribute] = model[attribute] || {};
    ary.forEach(function (d) {
        d = d.replace(";", "");
        model[attribute][d] = 1;
    });
    return model
}

function parseConstraint(line, model, constraint) {
    constraints = {
        ">=": "min",
        "<=": "max",
        "=": "equal"
    }
    var separatorIndex = line.indexOf(":");
    var constraintExpression = (separatorIndex === -1) ? line : line.slice(separatorIndex + 1);

    // Pull apart lhs
    const lhf = REGEX.parse_lhs(constraintExpression)

    // *** STEP 1 *** ///
    // Get the variables out
    lhf.forEach(function (d) {
        // Get the number if its there
        const coeff = REGEX.get_num(d);
        // Get the variable name
        const var_name = REGEX.get_word(d);

        // Make sure the variable is in the model
        model.variables[var_name] = model.variables[var_name] || {};
        model.variables[var_name][constraint] = coeff;
    });

    // *** STEP 2 *** ///
    // Get the RHS out
    rhs = REGEX.parse_rhs(line);

    // *** STEP 3 *** ///
    // Get the Constrainer out
    line = constraints[REGEX.parse_dir(line)];
    model.constraints[constraint] = model.constraints[constraint] || {};
    model.constraints[constraint][line] = rhs;

    return model
}

function parseArray(input) {
    const {
        is_bin,
        is_constraint,
        is_int,
        is_objective,
        is_unrestricted } = REGEX
    var model = {
        opType: '',
        optimize: '_obj',
        constraints: {},
        variables: {}
    }
    let constraint = 1
    for (var i = 0; i < input.length; i++) {
        // Get the string we're working with
        // Check why currentLine is mutable.
        let currentLine = input[i];
        // Test to see if we're the objective
        if (is_objective(currentLine)) {
            model = parseObjective(currentLine, model)
        } else if (is_int(currentLine)) {
            model = parseTypeStatement(currentLine, model, INT)
        } else if (is_bin(currentLine)) {
            model = parseTypeStatement(currentLine, model, BIN)
        } else if (is_unrestricted(currentLine)) {
            model = parseTypeStatement(currentLine, model, UNRESTRICTED)
        } else if (is_constraint(currentLine)) {
            model = parseConstraint(currentLine, model, 'R' + constraint)
            constraint++
        } else {
            console.log(`Cannot parse at line ${i}:`, `Content: ${currentLine}`)
            throw new Error(`Cannot parse at line ${i}.\nContent: ${currentLine}`)
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
    // Handle input if its coming
    // to us as a hard string
    // instead of as an array of
    // strings
    if (typeof input === "string") {
        let splits = []
        input = input.split('\n');
        input = input.map(e => {
            splits.push(...e.split(';').filter(x => x !== ''))
        })
        input = splits
    }

    // Start iterating over the rows
    // to see what all we have
    return parseArray(input);
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

module.exports = function (model) {
    // If the user is giving us an array
    // or a string, convert it to a JSON Model
    // otherwise, spit it out as a string
    if (model.length) {
        return to_JSON(model);
    } else {
        return from_JSON(model);
    }
};
