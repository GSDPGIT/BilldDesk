// WARN 该文件只是方便我将当前项目复制一份到我电脑的另一个位置（codeup私有仓库的位置)，其他人不需要管这个文件~

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import trash from 'trash';

const ignore = ['.DS_Store', '.git', 'node_modules'];
const localDir = '/Users/huangshuisheng/Desktop/hss/galaxy-s10/billd-desk';
const targetDir = [
  '/Users/huangshuisheng/Desktop/hss/galaxy-s10/billd-desk-admin',
  '/Users/huangshuisheng/Desktop/hss/galaxy-s10/billd-desk-flutter',
  '/Users/huangshuisheng/Desktop/hss/galaxy-s10/billd-desk-server',
];

function getDir() {
  return fs.readdirSync(localDir).filter((item) => {
    if (ignore.includes(item)) {
      return false;
    }
    return true;
  });
}

function findFile(inputDir) {
  const allFile = [];
  function main(inputDir) {
    for (let i = 0; i < inputDir.length; i += 1) {
      const file = inputDir[i];
      const filePath = `${localDir}/${file}`;
      const stat = fs.statSync(filePath);
      const isDir = stat.isDirectory();
      if (!isDir) {
        allFile.push(filePath);
      } else {
        main(fs.readdirSync(filePath).map((key) => `${file}/${key}`));
      }
    }
  }
  main(inputDir);
  return allFile;
}

function putFile(tDir, allFile) {
  for (let i = 0; i < allFile.length; i += 1) {
    const file = allFile[i];
    const arr = [];
    const githubFile = file.replace(localDir, '');
    const githubFileArr = githubFile.split('/').filter((item) => item !== '');
    githubFileArr.forEach((item) => {
      if (arr.length) {
        arr.push(path.resolve(arr[arr.length - 1], item));
      } else {
        arr.push(path.resolve(tDir, item));
      }
    });
    arr.forEach((item, index) => {
      // 数组的最后一个一定是文件，因此不需要判断它是不是目录
      if (index !== arr.length - 1) {
        const flag = fs.existsSync(item);

        !flag && fs.mkdirSync(item);
      }
    });
    fs.copyFileSync(file, path.join(tDir, './', file.replace(localDir, '')));
  }
}

async function clearOld(tDir) {
  const targetDirAllFile = fs.readdirSync(tDir);
  const queue = [];
  targetDirAllFile.forEach((url) => {
    const fullurl = `${tDir}/${url}`;
    if (!['.git', 'node_modules'].includes(url)) {
      queue.push(trash(fullurl));
    }
  });
  await Promise.all(queue);
}

targetDir.forEach((item) => {
  clearOld(item).then(() => {
    const allFile = findFile(getDir());
    putFile(item, allFile);

    execSync(`git rm -r --cached .`, { cwd: item });
    execSync(`git add .`, { cwd: item });
    execSync(`git commit -m 'docs: 更新文档'`, {
      cwd: item,
    });
    execSync(`git push`, { cwd: item });
  });
});

execSync(`git rm -r --cached .`, { cwd: localDir });
execSync(`git add .`, { cwd: localDir });
execSync(`git commit -m 'docs: 更新文档'`, {
  cwd: localDir,
});
execSync(`git push`, { cwd: localDir });
