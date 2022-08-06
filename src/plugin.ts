import path from 'node:path';
import fs from 'node:fs';
import prettier from 'prettier';
import type { Element, ElementContent } from 'hast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import type { Program, ImportDeclaration } from 'estree';

export type TransformOpts = {
    /**
     * Extensions that will be resolved with default `moduleResolver`
     * 
     * You can omit this if you are using custom `moduleResolver`
     * @default ['.tsx', '.js', '.json', '.ts', '.jsx', '.mdx']
     */
    extensions?: string[];

    /**
     * Filepath where all the relative/absolute file imports will 
     * be resolved against
     * 
     * You can omit this if you are using custom `moduleResolver`
     */
    filePath?: string;

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
    moduleResolver?: (module: string, ...args: unknown[]) => string;
};

const defaultResolver = (
    modulePath: string,
    { extensions = [], filePath }: TransformOpts,
    hasExt = false
) => {
    const { dir } = path.parse(filePath);
    let partialPath = path.relative(
        modulePath,
        dir
    );

    let found: string;
    let fileNotFoundErr: Error;

    if (hasExt) {
        return partialPath;
    }

    for (const ext of extensions) {
        try {
            if (found) {
                break;
            }

            const tryGetFile = fs.readFileSync(partialPath + ext, {
                encoding: 'utf-8',
            });
            found = tryGetFile;
        } catch (error) {
            fileNotFoundErr = error;
            continue;
        }
    }

    if (fileNotFoundErr) throw fileNotFoundErr;
    if (found) partialPath = found;

    return partialPath;
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

const transform = (options = {} as TransformOpts) => {
    options = {
        componentToInject: null,
        filePath: undefined,
        extensions: ['.tsx', '.js', '.json', '.ts', '.jsx', '.mdx'],
        propName: 'code',
        moduleResolver: defaultResolver,
        ...options,
    };
    const { componentToInject, moduleResolver, propName } = options;

    if (!componentToInject) {
        throw new Error(
            `rehype plugin error: 'componentToInject' needs to be defined`
        );
    }

    return () => (ast: Element) => {
        const nodes = filterNodes(ast.children, [
            'mdxjsEsm',
            'mdxJsxFlowElement',
        ]);

        getReplacementNodes(nodes, options, (node) => {
            const firstChild = node?.children?.[0];
            const resolvedModule = moduleResolver(
                findImportSpecifier(firstChild.name, importDeclarations(nodes)),
                options
            );

            if (resolvedModule) {
                setAttribute(node, propName, formatCode(resolvedModule));
            }
        });

        return ast;
    };
};

export default transform;
