import { definitionSyntax, DSNodeGroup } from 'css-tree';
import * as rawGlobalAttributes from 'mdn-browser-compat-data';

interface IRegularCompat {
  __compat: MDN.Compat;
}

interface IContextCompat {
  [context: string]: IRegularCompat;
}

export function getCompats(data: IRegularCompat | IContextCompat): MDN.Compat[] {
  return '__compat' in data
    ? [(data as IRegularCompat).__compat]
    : Object.keys(data).map(context => (data as IContextCompat)[context].__compat);
}

export function getSupport(support: MDN.Support | MDN.Support[]): MDN.Support[] {
  return Array.isArray(support) ? support : [support];
}

export function getAtRuleData(name: string) {
  return getData('at-rules', name);
}

export function getPropertyData(name: string) {
  return getData('properties', name);
}

export function getSelectorsData(name: string) {
  return getData('selectors', name);
}

export function getTypesData(name: string) {
  return getData('types', name);
}

async function getData(
  type: 'at-rules' | 'properties' | 'selectors' | 'types',
  name: string,
): Promise<MDN.CompatData | undefined> {
  try {
    const data = rawGlobalAttributes.css[type];

    if (!data) {
      return (undefined);
    }

    const cssData = data[name];

    return cssData;
  } catch (error) {
    return undefined;
  }
}

export function compatNames(compat: MDN.Compat, name: string, onlyRemoved = false): string[] {
  const properties: string[] = [];

  let browser: MDN.Browsers;
  for (browser in compat.support) {
    const support = compat.support[browser];

    for (const version of getSupport(support)) {
      // Assume that the version has the property implemented if `null`
      const isAdded = !!version.version_added || version.version_added === null;
      const isRemoved = !!version.version_removed;

      if (isAdded && isRemoved === onlyRemoved) {
        if (version.prefix) {
          properties.push(version.prefix + name);
        }
        if (version.alternative_name) {
          properties.push(version.alternative_name);
        }
      }
    }
  }

  return properties;
}

export function compatSyntax(data: MDN.CompatData, node: DSNodeGroup): DSNodeGroup {
  const nodeClone = definitionSyntax.parse(definitionSyntax.generate(node));

  let currentGroup = node;
  definitionSyntax.walk(nodeClone, node => {
    if (node.type === 'Keyword') {
      if (node.name in data) {
        const compats = getCompats(data[node.name]);
        if (compats.every(compat => !isAddedBySome(compat))) {
          // The keyword needs to be added by some browsers so we remove previous
          // combinator and skip this keyword
          return;
        }
      }

      const alternatives = alternativeKeywords(data, node.name);

      if (alternatives.length > 0) {
        for (const keyword of alternatives) {
          currentGroup.terms.push({
            type: 'Keyword',
            name: keyword,
          });
        }
      }
    } else if (node.type === 'Group') {
      currentGroup = node;
    }
  });

  return nodeClone;
}

function alternativeKeywords(data: MDN.CompatData, value: string): string[] {
  const alternatives: string[] = [];

  if (value in data) {
    const compats = getCompats(data[value]);

    for (const compat of compats) {
      let browser: MDN.Browsers;
      for (browser in compat.support) {
        const support = compat.support[browser];

        for (const version of Array.isArray(support) ? support : [support]) {
          const isCurrent =
            // Assume that the version has the value implemented if `null`
            !!version.version_added || version.version_added === null;

          if (isCurrent) {
            if (version.prefix && !alternatives.includes(version.prefix + value)) {
              alternatives.push(version.prefix + value);
            }
            if (version.alternative_name && !alternatives.includes(version.alternative_name)) {
              alternatives.push(version.alternative_name);
            }
          }
        }
      }
    }
  }

  return alternatives;
}

export function isDeprecated(data: { status?: string }, compat?: MDN.Compat) {
  // Assume not deprecated if is status i missing
  return data.status === 'obsolete' || (!!compat && !!compat.status && compat.status.deprecated);
}

export function isAddedBySome(compat: MDN.Compat): boolean {
  let browser: MDN.Browsers;
  for (browser in compat.support) {
    const support = compat.support[browser];

    for (const version of getSupport(support)) {
      // Assume that the version has the property implemented if `null`
      if (!!version.version_added || version.version_added === null) {
        return true;
      }
    }
  }

  return false;
}

export async function alternativeSelectors(selector: string): Promise<string[]> {
  const alternatives: string[] = [];

  // Pseudo without ':'
  const colons = ':'.repeat(selector.lastIndexOf(':') + 1);
  const name = selector.slice(colons.length);
  const compatibilityData = await getSelectorsData(name);

  if (compatibilityData) {
    const compats = getCompats(compatibilityData);

    for (const compat of compats) {
      let browser: MDN.Browsers;
      for (browser in compat.support) {
        const support = compat.support[browser];

        for (const version of getSupport(support)) {
          // Assume that the version has the property implemented if `null`
          const isAdded = !!version.version_added || version.version_added === null;

          if (isAdded) {
            if (version.prefix) {
              alternatives.push(colons + version.prefix + name);
            }
            if (version.alternative_name) {
              alternatives.push(version.alternative_name);
            }
          }
        }
      }
    }

    return alternatives;
  }

  return alternatives;
}

export function alternativeAttributes(name: string, data: MDN.CompatData): string[] {
  const alternatives: string[] = [];
  const compats = getCompats(data);

  for (const compat of compats) {
    for (const browser in compat.support) {
      const support = (compat.support as any)[browser];

      for (const version of getSupport(support)) {
        // Assume that the version has the property implemented if `null`
        const isAdded = !!version.version_added || version.version_added === null;

        if (isAdded) {
          if (version.prefix) {
            alternatives.push(version.prefix + name);
          }
          if (version.alternative_name) {
            alternatives.push(version.alternative_name);
          }
        }
      }
    }
  }

  return alternatives;
}
