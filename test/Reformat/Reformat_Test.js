const Reformat = require('../../src/Reformat')

const test_cases = () => {
  const test = [
    'max: -12x + y;',
    'max: -12x+ y;',
    'max:-12x+y;',
    'max:-12x+ y',
    'max: -12    x + y;',
    'max: -12    x + 1y;',
    'max: -12x + 1y;',
    'max: -12x+ 1y;',
    'max:-12x+1y;',
  ]
  const didPass = (r) => {
    const type = r.opType === 'max'
    const objective = r.optimize === '_obj'
    const constraints = Object.entries(r.constraints).length === 0 && r.constraints.constructor === Object
    let vars = Object.entries(r.variables).length === 2 && r.variables.constructor === Object
    if (!vars) {
      console.log('Ended early. Improper variables', r.variables)
      return false
    }
    vars = r.variables

    const hasX = vars.x !== undefined && vars.x._obj === -12
    const hasY = vars.y !== undefined && vars.y._obj === 1
    console.log(r, hasX, hasY, constraints, objective, type)
    return hasX && hasY && constraints && objective && type
  }
  const runTest = () => {
    let failed = 0
    for (const i in test) {
      const txt = test[i]
      const result = Reformat(txt)
      const res = didPass(result)
      failed += res ? 0 : 1
      if (!res) {
        console.log(`Test ${parseInt(i) + 1} failed.\n`)
      }
    }
    return `${failed} tests failed.`
  }

  return {
    runTest
  }
}

console.log(test_cases().runTest())