// https://gist.github.com/ryanflorence/ec1849c6d690cfbffcb408ecd633e069
import type {LoaderFunction, V2_MetaFunction} from '@remix-run/node';
import type {V2_ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';

export default function mergedMeta<
  Loader extends LoaderFunction,
  ParentsLoaders extends Record<string, LoaderFunction>,
>(
  leafMetaFn: V2_MetaFunction<Loader, ParentsLoaders>,
): V2_MetaFunction<Loader, ParentsLoaders> {
  return (arg) => {
    let leafMeta = leafMetaFn(arg);

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
            ('title' in meta && 'title' in parentMeta),
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
      (meta) => meta.name === 'description',
      'content',
    );

    return data;
  };
}

function setOG(
  data: V2_ServerRuntimeMetaDescriptor[],
  ogProperty: string,
  indexFinder: (meta: V2_ServerRuntimeMetaDescriptor) => boolean,
  key: string,
) {
  const index = data.findIndex(indexFinder);
  if (index > -1) {
    const title = data[index][key];
    const ogIndex = data.findIndex((meta) => meta.property === ogProperty);
    if (ogIndex > -1) {
      data[ogIndex].content = title;
    } else {
      data.push({
        property: ogProperty,
        content: title,
      });
    }
  }
}
