/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : Wednesday Jun 08, 2022 16:19:15 CST
 *
 * @description : tty
 *
 ******************************************************************************/

abstract class Stream {
  format?: (text: string) => string;
}

abstract class ReadableStream extends Stream {
  abstract read(): Promise<string>;
}

abstract class WritableStream extends Stream {
  abstract write(text: string): number;
  abstract flush();
}

interface Terminal {
  readonly stdin?: ReadableStream;
  readonly stdout?: WritableStream;
  readonly stderr?: WritableStream;
}

interface Command {
  (this: Terminal, argv: string[]): number | Promise<number>;
}

interface Settings {}
namespace Settings {
  export const Defaults: Settings = {};
}

class InputStream extends ReadableStream {
  read(): Promise<string> {
    return Promise.resolve("");
  }
}

class OutputStream extends WritableStream {
  private buffer: string[] = [];
  write(text: string): number {
    this.buffer.push(text);
    if (/\n$/.test(text)) this.flush();
    return text.length;
  }
  flush() {
    this.onFlush?.(this.buffer.splice(0).join(""));
  }

  onFlush?: (text: string) => void;
}

export class TTY implements Terminal {
  static ID = "TTY-" + Math.random().toString(36).slice(2).toUpperCase();
  readonly id = "tty-" + Math.random().toString(36).slice(2);
  readonly settings: Settings = {};
  readonly history: string[] = [];

  readonly stdin = new InputStream();
  readonly stdout = new OutputStream();
  readonly stderr = new OutputStream();

  private output: HTMLDivElement;
  private input: HTMLDivElement;
  private style: HTMLStyleElement;

  readonly commands: Record<string, Command>;

  constructor(commands: Record<string, Command>) {
    this.commands = { ...commands };
    this.stdout.onFlush = (text) => this.display(text);
    this.stderr.onFlush = (text) => this.display(text);
  }

  render(container: HTMLDivElement) {
    if (this.output?.parentElement instanceof HTMLElement) {
      this.output.parentElement.className = this.output.parentElement.className
        .split(/\s+/g)
        .filter((name) => name !== "tty")
        .join(" ");
      this.output.parentElement.removeEventListener("click", this.focus);
    }
    if (this.output) this.output.remove();
    if (this.input) {
      this.input.remove();
      this.input.removeEventListener("keydown", this.onkeydown);
    }

    container.className = container.className
      .split(/\s/g)
      .filter((name) => name !== "tty")
      .concat("tty")
      .join(" ");

    container.innerHTML = "";

    this.output = document.createElement("div");
    this.output.className = this.id;
    container.append(this.output);

    this.input = document.createElement("div");
    this.input.className = this.id;
    this.input.addEventListener("keydown", this.onkeydown);
    this.input.contentEditable = "true";
    container.append(this.input);

    container.addEventListener("click", this.focus);

    if (!this.style) {
      this.style = document.createElement("style");
      this.style.id = this.id;
      document.head.append(this.style);
      this.dirty();
    }

    if (!document.getElementById(TTY.ID)) {
      const style = document.createElement("style");
      style.id = TTY.ID;
      style.innerHTML = `
      .tty {
        border: 1px solid white;
        border-radius: 10px;
        overflow-y: scroll;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        color: lightgrey;
        padding: 7px 13px;
        font-size: 1em;
        line-height: 1.3em;
        background-color: black;
      }
      .tty>div {
        background-color: black;
      }
      .tty>div[contentEditable] {
        outline: none;
        position: relative;
        padding-left: 1em;
      }
      .tty>div[contentEditable]:before {
        content: "> ";
        position: absolute;
        left: 0;
        top: 0;
      }
      .tty>div[contentEditable]:after {
        content: attr(data-auto);
        position: absolute;
        left: 1em;
        bottom: -1em;
      }
      .tty>div>.cmd {
        display: block;
      }
      .tty>div>.cmd:before {
        content: "> "
      }
      ${["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]
        .map((color, index) => `.tty span.c3${index} { color: ${color}; }`)
        .join("\n")}
      ${["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]
        .map(
          (color, index) =>
            `.tty span.c4${index} { background-color: ${color}; }`
        )
        .join("\n")}
      `.replace(/\n\s+/g, "");
      document.head.append(style);
    }
  }

  get<S extends keyof Settings>(name: S): Settings[S] {
    let value = this.settings[name];
    if (value === undefined) value = Settings.Defaults[name];
    return value;
  }

  set<S extends keyof Settings>(name: S, value: Settings[S]) {
    if (value === this.get(name)) return;
    this.settings[name] = value;
    this.dirty();
  }

  private dirty() {
    // update settings effect
    if (!this.input && !this.output) return;
  }

  private display(text: string, type?: "cmd") {
    if (text.length === 0) return;
    const div = document.createElement("span");
    if (type) div.className = type;
    // TODO: parse color escape
    div.innerHTML = text
      .replace(/\u001b\[\d*m/g, escape)
      .replace("\n", "<br/>");
    this.output.append(div);
  }

  private readonly focus = (event?: MouseEvent) => {
    if (event) {
      const selection = document.getSelection();
      if (selection && selection.toString()) return;
    }
    this.input.focus();
  };
  private readonly onkeydown = (event: KeyboardEvent) => {
    if (event.code === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      // TODO: auto complete
    }
    if (event.code === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();

      const command = this.input.innerText.trim();
      this.input.innerText = "";

      // 1. push command to history
      const [cmd, ...argv] = normalize(command);
      if (!cmd) return;
      this.display(command, "cmd");

      // 2. cmd not found
      if (typeof this.commands[cmd] !== "function") {
        this.stderr.write(`\u001b[31mCommand not found: ${cmd}\n`);
        return;
      }

      // 3. execute
      // disable input when executing
      this.input.contentEditable = "false";
      new Promise((resolve) => resolve(this.commands[cmd].call(this, argv)))
        .then((code) => {
          if (code !== 0) this.stderr.write(`Exit ${code}`);
        })
        .catch((error) => {
          this.stderr.write(error.message);
          if (error.stack) this.stderr.write(error.stack);
        })
        .then(() => {
          this.input.contentEditable = "true";
          this.focus();
          this.stdout.flush();
          this.stderr.flush();
        });
    }
  };
}

function normalize(input: string): string[] {
  const escape = /\\/;
  const quote = /['"]/;
  const space = /\s/;

  let isEscape: boolean = false;
  let isQuote: boolean | string = false;

  const items = [];
  const item = [];

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (isEscape) {
      item.push(char);
      isEscape = false;
      continue;
    }
    if (escape.test(char)) {
      isEscape = true;
      continue;
    }

    if (quote.test(char)) {
      if (!isQuote) isQuote = char;
      else if (isQuote === char) {
        isQuote = false;
      } else {
        item.push(char);
      }
      continue;
    }
    if (isQuote) {
      item.push(char);
      continue;
    }

    if (space.test(char)) {
      if (item.length) items.push(item.splice(0).join(""));
      continue;
    }

    item.push(char);
  }

  if (item.length) items.push(item.join(""));

  return items;
}

function escape(color): string {
  const [_, code] = color.match(/(\d+)m$/);
  if (code === "0") {
    return "</span>";
  } else {
    return `<span class="c${code}">`;
  }
}
