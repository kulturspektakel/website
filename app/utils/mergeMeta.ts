// https://gist.github.com/ryanflorence/ec1849c6d690cfbffcb408ecd633e069
import type {MetaFunction} from '@remix-run/node';
import type {ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';

export default function mergedMeta<Loader>(
  // @ts-ignore
  leafMetaFn: MetaFunction<Awaited<ReturnType<Awaited<Loader>>>['typedjson']>,
): MetaFunction<Loader, any> {
  return (arg) => {
    let leafMeta = leafMetaFn(arg as any);

    const data = arg.matches.reduceRight((acc, match) => {
      for (let parentMeta of match.meta) {
        let index = acc.findIndex(
          (meta) =>
            ('name' in meta &&
              'name' in parentMeta &&
              meta.name === parentMeta.name) ||
            ('property' in meta &&
              'property' in parentMeta &&
              meta.property === parentMeta.property) ||
            ('title' in meta && 'title' in parentMeta) ||
            ('charset' in meta && 'charset' in parentMeta),
        );
        if (index == -1) {
          // Parent meta not found in acc, so add it
          acc.push(parentMeta);
        }
      }
      return acc;
    }, leafMeta);

    setOG(data, 'og:title', (meta) => 'title' in meta, 'title');
    setOG(
      data,
      'og:description',
      (meta) => 'name' in meta && meta.name === 'description',
      'content',
    );

    return data;
  };
}

function setOG(
  data: ServerRuntimeMetaDescriptor[],
  ogProperty: string,
  indexFinder: (meta: ServerRuntimeMetaDescriptor) => boolean,
  key: string,
) {
  const index = data.findIndex(indexFinder);
  if (index > -1) {
    // @ts-ignore
    const title = data[index][key];
    const ogIndex = data.findIndex(
      (meta) => (meta as any).property === ogProperty,
    );
    if (ogIndex > -1) {
      (data[ogIndex] as any).content = title;
    } else {
      data.push({
        property: ogProperty,
        content: title,
      });
    }
  }
}
