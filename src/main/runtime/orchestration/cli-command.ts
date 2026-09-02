import { CLI_COMMAND_NAME } from '../../../shared/cli-command-name'

/* The command name the dispatch preamble teaches an agent to run.
 *
 * This used to be a two-member union resolved per host: the pre-rebrand CLI installed `orca` on
 * macOS/Windows and `orca-ide` on Linux, where a bare `orca` collided with the GNOME Orca screen
 * reader. `aio-ade` has no such collision, so one name is installed on every host and there is
 * nothing left to resolve from connection, WSL or project-runtime context. */
export type OrchestrationCliCommand = typeof CLI_COMMAND_NAME

export function resolveTerminalOrchestrationCliCommand(): OrchestrationCliCommand {
  return CLI_COMMAND_NAME
}
