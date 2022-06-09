/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : Tuesday May 31, 2022 10:28:04 CST
 *
 * @description : index
 *
 ******************************************************************************/
export {};

class Stream {
  format?: (text: string) => string;
}

class ReadStream extends Stream {
  async read() {
    return "";
  }
}
class WriteStream extends Stream {
  async write(message: string) {
    if (this.format) message = this.format(message);
    display(message);
  }
}

function display(text: string, props?: Partial<HTMLDivElement>) {
  const div = document.createElement("div");
  for (const [key, value] of Object.entries(props || {})) {
    div[key] = value;
  }
  div.innerText = text;
  element("history").append(div);
  element("input").scrollIntoView();
}

interface Command {
  stdin: ReadStream;
  stdout: WriteStream;
  stderr: WriteStream;
  (this: Command, argv: string[]): number;
}

function element(id: string): undefined | HTMLElement {
  return document.getElementById(id);
}

async function loadsh(): Promise<Record<string, Command>> {
  return new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "./sh.js";
    script.onload = function () {
      script.remove();
    };
    document.head.append(script);
    document.addEventListener("sh.js", function onsh(event: CustomEvent) {
      document.removeEventListener("sh.js", onsh);
      const sh = event.detail;
      resolve(sh);
    });
  });
}

window.addEventListener("load", async function onload() {
  window.removeEventListener("load", onload);
  const sh = await loadsh();

  const stdin = new ReadStream();
  const stdout = new WriteStream();
  const stderr = new WriteStream();

  element("console")?.addEventListener("click", function () {
    const selection = document.getSelection();
    if (selection && selection.toString()) return;
    element("input")?.focus();
  });

  element("input")?.addEventListener("keyup", function (event) {
    const code = event.code;
    if (code !== "Enter") return;
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const line = event.currentTarget.value.trim();
    if (!line) return;

    event.currentTarget.value = "";

    // 1. push command to history
    display(line, { className: "cmd" });

    // 2. find command
    const [command, ...argv] = line.split(/\s+/g);
    const execute = sh[command];
    if (typeof execute !== "function") {
      stderr.write("command not found");
      return;
    }

    // 3. execute command
    execute.stdin = stdin;
    execute.stdout = stdout;
    execute.stderr = stderr;
    const status = execute.call(execute, argv);

    // 4. push result to history
    if (status !== 0) stderr.write("exit " + status);
  });
});
