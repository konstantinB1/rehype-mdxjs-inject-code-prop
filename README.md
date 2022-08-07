# About

A [MDX](https://github.com/mdx-js/mdx) - [rehype](https://github.com/rehypejs/rehype) plugin that uses injects `code` prop on targeted components. Code segment is generated from target component's `children` property.

This is a lightweight and straightforward implementation of storybook concept as you can get code preview + code really fast while documenting your components inside `.mdx` files

Uses [prettier](https://github.com/prettier/prettier) to format code segment.

# Installataion

`npm install rehype-mdxjs-inject-code-prop -D`

or

`yarn add rehype-mdxjs-inject-code-prop -D`

## Usage

#### With mdx core compiler

```typescript
import { transform as rehypeInjectCodeAsProp } from 'rehype-mdxjs-inject-code-prop'
import { compile } from '@mdx-js/mdx';

const code = compile('./src/mdxFileSource.mdx', {
    rehypePlugins: [rehypeInjectCodeAsProp({
        componentToInject: /MyCodeComponent|MyOtherCodeComponent/
    })]
});

// Do something with the code...
// console.log(code) 

```

## Options

| option | required | Description | default |
| --- | --- | --- | --- |
| extensions | `false` | What extensions will be used when resolving source code paths. Unused if custom `moduleResolver` is used | `['.tsx', '.js', '.json', '.ts', '.jsx', '.mdx']`
| componentToInject | `true` | Component name(s) where code will be injected | `undefined`
| propName | `false` | Prop access inside JSX component | `code`
| moduleResolver | `false` | A custom function resolver for ES modules inside MDX files. You probably don't wanna tackle this unless you need some specific module resolving logic. By default it uses browserify [resolve](https://github.com/browserify/resolve) | `resolveSync(...)`