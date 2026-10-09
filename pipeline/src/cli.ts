import { runValidationCli } from './validate-cli';
import { runGenerationCli } from './generate-cli';

const args = process.argv.slice(2);
process.exitCode = await (args[0] === '--generate' ? runGenerationCli : runValidationCli)(args, {
  stdout: message => console.log(message),
  stderr: message => console.error(message),
});
