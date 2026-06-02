import config from './config.js';
const variables = new Set();
import fs from 'fs';
import path from 'path';

function replaceVariables(string) {
  return string.replace(
    /{{\s?(?:dynamic\.)(\w+)\s?}}/gm,
    (_, k) => '${' + k + '}',
  );
}

/** @type {import('@maizzle/framework').Config} */
export default {
  ...config,
  locals: {
    dynamic: new Proxy(
      {},
      {
        get: function (target, property) {
          if (property in target) {
            return target[property];
          }
          if (typeof property === 'string' && property !== '$$typeof') {
            variables.add(property);
            return '${' + property + '}';
          }
          return property.toString();
        },
      },
    ),
  },
  afterTransformers: async function ({html, config}) {
    if (!config.page.title) {
      throw new Error('Title missing');
    }

    if (!config._text) {
      throw new Error('Plaintext missing');
    }

    const subject = replaceVariables(config.page.title);
    const text = replaceVariables(config._text);

    html = `// auto-generated file using yarn generate:mail
// prettier-ignore

export default ({${[...variables].join(', ')}}: {${[...variables]
      .map((v) => `${v}: string`)
      .join(', ')}}) => ({
  subject: \`${subject}\`,
  html: \`${html}\`,
  text: \`${text}\`
});
`;
    variables.clear();
    return html;
  },
  afterBuild: async function ({files, config}) {
    fs.writeFileSync(
      config.build.output.path + '/index.ts',
      `// auto-generated file using yarn generate:mail
// prettier-ignore

${files.map((f) => `import ${path.basename(f, path.extname(f))} from './${path.basename(f, path.extname(f))}';`).join('\n')}

export default {
${files.map((f) => `  ${path.basename(f, path.extname(f))},`).join('\n')}
};`,
    );
  },
};
