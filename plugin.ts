import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';
import type { Element, ElementContent } from 'hast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import type { VFile } from 'vfile';
import type { Program, ImportDeclaration } from 'estree';
import  { sync as resolveSync } from 'resolve'

export type TransformOpts = {
    /**
     * Extensions that will be resolved with default `moduleResolver`
     * 
     * You can omit this if you are using custom `moduleResolver`
     * @default ['.tsx', '.js', '.json', '.ts', '.jsx', '.mdx']
     */
    extensions?: string[];

    /**
     * Name(s) of components where code will be injected
     */
    componentToInject: string | RegExp | null;
    
    /**
     * Name of the prop that will be used when code is injected
     * @default code
     */
    propName?: string;

    /**
     * Custom module resolver that will handle all the import declarations
     * inside MDX file.
     */
    moduleResolver?: (module: string) => string;
};

const formatCode = (code: string, parser = 'babel') =>
    prettier.format(code, {
        parser,
        tabWidth: 4,
        semi: true,
    });

const setAttribute = (node: MdxJsxFlowElement, name: string, value: string) =>
    (node.attributes = [
        ...node.attributes,
        { type: 'mdxJsxAttribute', name, value },
    ]);

const filterNodes = (children: ElementContent[], nodes: string[] = []) =>
    children.filter((node) => nodes.includes(node.type));

const resolveComponentName = (nodeName: string, name: TransformOpts['componentToInject']) =>
    typeof name === 'string'
        ? name === nodeName
        : name instanceof RegExp
        ? name.test(nodeName)
        : false;

const getReplacementNodes = (
    ast: ElementContent[],
    options: TransformOpts,
    callback: (node: MdxJsxFlowElement) => void
) =>
    ast.forEach((node) => {
        if (
            node.type === 'mdxJsxFlowElement' &&
            resolveComponentName(node.name, options.componentToInject)
        ) {
            callback(node);
        }
    });

const importDeclarations = (ast: ElementContent[]): ImportDeclaration[] =>
    ast
        .filter((n) => n.type === 'mdxjsEsm')
        .reduce((acc, n) => [...acc, ...(n.data.estree as Program).body], []);

const findImportSpecifier = (
    nodeName: string,
    imports: ImportDeclaration[]
) => {
    for (const imp of imports) {
        for (const spec of imp.specifiers) {
            if (spec.local.name === nodeName) {
                return imp.source.value as string;
            }
        }
    }
};

export function transform (options = {} as TransformOpts)  {
    options = {
        componentToInject: null,
        extensions: ['.tsx', '.js', '.json', '.ts', '.jsx', '.mdx'],
        propName: 'code',
        moduleResolver: undefined,
        ...options,
    };
    const { componentToInject, extensions, moduleResolver, propName } = options;

    if (!componentToInject) {
        throw new Error(
            `rehype plugin error: 'componentToInject' needs to be defined`
        );
    }
    
    return () => (ast: Element, file: VFile) => {
        const nodes = filterNodes(ast.children, [
            'mdxjsEsm',
            'mdxJsxFlowElement',
        ]);
        
        getReplacementNodes(nodes, options, (node) => {
            // @ts-ignore
            const firstChild = node?.children?.[0]?.name;
            const specifier = findImportSpecifier(firstChild, importDeclarations(nodes));
            const transformedFile = file.history?.[0]
            let resolvedModule: string | undefined;

            if (typeof moduleResolver === 'function' && specifier) {
                resolvedModule = moduleResolver(specifier)
            } else {
                resolvedModule = resolveSync(specifier, {
                    basedir: path.dirname(transformedFile),
                    extensions,
                    includeCoreModules: false,
                });
            }

            if (resolvedModule) {
                const contents = fs.readFileSync(resolvedModule, { encoding: 'utf-8'})
                setAttribute(node, propName, formatCode(contents));
            }
        });

        return ast;
    };
}

