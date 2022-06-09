document.dispatchEvent(
  new CustomEvent("sh.js", {
    detail: {
      cd,
      ls,
      pwd,
      mkdir,
      rm,
      chmod,
    },
  })
);

// 每个函数可以通过 this.stdout.write 打印字符到虚拟终端

const path = [];

function cd(argv) {
  this.stderr.write("not implemented");
  return 0;
}

function ls(argv) {
  this.stderr.write("not implemented");
  return 0;
}

function pwd(argv) {
  this.stderr.write("not implemented");
  return 0;
}

function mkdir(argv) {
  this.stderr.write("not implemented");
  return 0;
}

function rm(argv) {
  this.stderr.write("not implemented");
  return 0;
}

function chmod(argv) {
  this.stderr.write("not implemented");
  return 0;
}
