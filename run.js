/* eslint-disable @typescript-eslint/no-var-requires */

const { performance } = require('perf_hooks')
const Path = require('path')
const Fs = require('fs')
const chalk = require('chalk')

const SECOND = 1000
const MINUTE = SECOND * 60

const norm = (path) => path.split(Path.sep).join('/')
const relnorm = (path) => norm(Path.relative(__dirname, path))

require('@babel/register')({
  configFile: Path.resolve(__dirname, 'babel.config.js'),
  extensions: ['.js', '.ts'],
  cache: true,
})

const allTasks = Fs.readdirSync(__dirname)
  .filter((n) => /^\d\d\d\d$/.test(n))
  .reduce((tasks, year) => {
    return [
      ...tasks,
      ...Fs.readdirSync(Path.resolve(__dirname, year)).map((day) => {
        const dir = Path.resolve(__dirname, year, day)
        const inputNames = Fs.readdirSync(Path.resolve(dir, 'inputs'))
        const tests = inputNames.filter((n) => n.includes('test'))
        const inputs = inputNames.filter((n) => !n.includes('test'))

        const getSolutions = () =>
          Fs.readdirSync(dir).filter(
            (n) =>
              ['.js', '.ts'].includes(Path.extname(n)) &&
              typeof require(Path.resolve(dir, n)).run === 'function',
          )

        return {
          dir,
          year,
          day,
          tests,
          inputs,
          getSolutions,
        }
      }),
    ]
  }, [])

function resolveTasks(path = '.') {
  const selector = relnorm(Path.resolve(path))
  const [yearSelector, daySelector, solutionSelector] = selector.split('/')

  const tasks = allTasks
    .filter(
      (task) =>
        (!yearSelector || task.year === yearSelector) &&
        (!daySelector || task.day === daySelector),
    )
    .map((task) => {
      return {
        ...task,
        solutions: task
          .getSolutions()
          .filter((solution) =>
            solutionSelector ? solution.startsWith(solutionSelector) : true,
          ),
      }
    })
    .filter((task) => task.solutions.length)

  if (!tasks.length) {
    throw new Error(`selector [${selector}] doesn't match any tasks`)
  }

  return tasks
}

function readInput(dir, name) {
  const path = Path.resolve(dir, 'inputs', name)
  switch (Path.extname(name)) {
    case '.txt':
      return Fs.readFileSync(path, 'utf-8')
    case '.js':
    case '.ts': {
      return require(path).input
    }
  }
}

function formatTime(ms) {
  if (ms < SECOND) {
    return `${ms.toFixed(1)}ms`
  }
  if (ms < MINUTE) {
    return `${(ms / SECOND).toFixed(2)}sec`
  }
  return `${Math.floor(ms / MINUTE)}min ${formatTime(ms % MINUTE)}`
}

function runSolution(dir, name, input) {
  const path = Path.resolve(dir, name)
  const { run } = require(path)
  const start = performance.now()
  run(input)
  const end = performance.now()
  console.log(chalk.grey(`took ${formatTime(end - start)}`))
}

const tasks = resolveTasks(...process.argv.slice(2))

for (const task of tasks) {
  if (tasks.length > 1) {
    console.log(
      `${chalk.bgRed.green(task.year)}/${chalk.bgGreen.red(task.day)}:`,
    )
  }

  for (const solution of task.solutions) {
    for (const test of task.tests) {
      console.log(chalk.grey(`test(${solution}, ${test}):`))
      runSolution(task.dir, solution, readInput(task.dir, test))
      console.log()
    }

    for (const input of task.inputs) {
      console.log(chalk.grey(`run(${solution}, ${input}):`))
      runSolution(task.dir, solution, readInput(task.dir, input))
      console.log()
    }
  }
}
