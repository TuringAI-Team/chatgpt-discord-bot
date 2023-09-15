# Turing AI Discord bot
The best  way to use AI in your discord server!

## Development
This project requires the usage of [bun](https://bun.sh) to build and run the project.

### Building
To build the project, run `bun build` in the root directory of the project. This will create a `build` directory with the compiled files.

### Running
To run the project, run 
```bash
bun run start:db
bun run start:gateway
bun run start:bot
```

## Workflow guide:
1. While developing  use `bun run build`,
2. When you are going to commit, use `bun run build:all` to build the project,