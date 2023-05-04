import { exec } from "child_process";

export interface GitCommit {
    message: string;
    hash: string;
}

export class Git {
    private static async exec(command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(command, (error, output) => {
                if (error !== null) return reject(error);
                resolve(output.toString().trim());
            });
        });
    }

    private static async latestCommitMessage(): Promise<string> {
        return this.exec(`git log -1 --format="%s"`);
    }

    private static async latestCommitHash(): Promise<string> {
        return this.exec(`git rev-parse HEAD`);
    }

    public static async latestCommit(): Promise<GitCommit> {
        return {
            message: await this.latestCommitMessage(),
            hash: await this.latestCommitHash()
        };
    }
}