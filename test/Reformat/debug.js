const parseArray = require('../../src/Reformat').parseObjective
const toJSON = require('../../src/Reformat').to_JSON
const rxo = require('../../src/Reformat').REGEX.rxo

const test = [
  'max: -x + y;',
  'max: +12x+ y;',
  'max:12x+y;',
  'max:12x+ y',
  'max: 12    x + y;',
  'max: 12    x + 1y;',
  'max: 12x + 1y;',
  'max: 12x+ 1y;',
  'max:12x+1y;',
]

const model = {
  "opType": "",
  "optimize": "_obj",
  "constraints": {},
  "variables": {}
}

const statement = 'max:x+y;x <= 2;unrestricted y;'

console.log(toJSON(statement, model))
