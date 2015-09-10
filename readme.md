Hey, this isn't really tested in production, let me know how it treats you.

# Command line svg store

A less featured, command line version of [grunt-svgstore](https://github.com/FWeinb/grunt-svgstore).

## Why?

Concat svgs without grunt or gulp.

## Use

```shell
npm install cl-svgstore --save-dev
```

In `package.json`:

```json
{
  "scripts": {
    "svg": "svgstore 'src/*.svg' dest/out.svg"
  }
}
```

Thanks to [javascriptplayground](http://javascriptplayground.com/blog/2015/03/node-command-line-tool/) for the node command line tutorial.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style.

## Release History

#### 0.2.0
  * Adds css parsing!

#### 0.1.3
  * Rework of file write order in preperation of future improvements on CSS parsing

#### 0.1.1
  * Updated readme

#### 0.1.0
  * Inital release