#! /usr/bin/env node
	
var fs       = require('fs')
	, path     = require('path')
	, glob     = require('glob')
	, through2 = require('through2')
	, spigot   = require('stream-spigot')
	, concat   = require('concat-stream')
	, cheerio  = require('cheerio')

	// arguments passed from the command line
	, userArgs = process.argv.slice(2)
	, inGlob   = userArgs[0]
	, outPath  = userArgs[1]

/**
 * A class used for storing, retrieving, and compiling css extracted from SVGs
 *
 * @returns {function}
 */
var StyleStore = (function () {
	function StyleStore () {
		this._ = {}
		this._.styles = []
	}

	/**
	 * function description
	 *
	 * @param {string} foo - foo description
	 * @returns {string}
	 */
	StyleStore.prototype.save = function (sourcefilename, content) {
		this._.styles.push({
			name: sourcefilename,
			content: content
		})
	}

	/**
	 * function description
	 *
	 * [ ] todo? - compare what styles are present and eliminate duplicates
	 *
	 * @param {string} foo - foo description
	 * @returns {string}
	 */
	StyleStore.prototype.compile = function () {
		return this._.styles.reduce(function (p, c) {
			return p + ' ' + c.content
		}, '')
	}

	return StyleStore
}())

if (inGlob) {
	glob(inGlob, function (err, matches) {

		if (err) throw new Error(err)

		var svgTag = {
					open: '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n',
					close: '\n</svg>'
				}
			, styleStore = new StyleStore()

		/**
		 * Data about a svg file
		 * 
		 * @typedef {object} SVGObjectFile
		 * @property {string} filename - filename
		 * @property {string} raw - raw html response of file
		 * @property {object} $svg - cheerio instance of the returned html
		 */
		/**
		 * Converts a file to an svg <symbol> element
		 *
		 * @param {buffer} chunk - filename
		 * @param {number} index - not sure what this is tbh
		 * @param {function} cb - callback for when process is completed
		 * @returns {SVGObjectFile}
		 */
		function parseFile (chunk, index, cb) {

			var self = this
				, filename = chunk.toString('utf-8')

			fs.readFile(filename, function (err, res) {

				if (err) throw new Error(err)

				var raw  = res.toString('utf-8')
					, $    = cheerio.load(raw)
					, $svg = $('svg')

				cb(null, {
					filename: path.parse(filename).name,
					raw: raw,
					$svg: $svg
				})
			})
		}

		/**
		 * Extracts and concatinates `<style>`s from `SVGObjectFile`s
		 *
		 * @param {SVGObjectFile} chunk - file info
		 * @param {number} index - not sure what this is tbh
		 * @param {function} cb - callback for when process is completed
		 * @returns {SVGObjectFile}
		 */
		function extractStyle (chunk, index, cb) {
			var styleContent = chunk.$svg.find('style')

			styleStore.save(chunk.filename, styleContent.html())

			styleContent.remove()

			cb(null, chunk)
		}

		/**
		 * Converts `SVGObjectFile` to a string representation of the svg `<symbol>`
		 *
		 * @param {SVGObjectFile} chunk - file info
		 * @param {number} index - not sure what this is tbh
		 * @param {function} cb - callback for when process is completed
		 * @returns {string}
		 */
		function createSymbol (chunk, index, cb) {
			var contents = chunk.$svg.html()
				, viewBox  = chunk.$svg.attr('viewbox') || '0 0 1 1'

		  cb(null, '<symbol id="' + chunk.filename + '" viewBox="' + viewBox + '">' + contents + '</symbol>')
		}

		/**
		 * Conditionally write to a file or the console
		 *
		 * @returns {function}
		 */
		function getWriteStream () {
			/**
			 * Curry-ished write file function
			 *
			 * @param {Object} _stream - stream to be written to
			 * @returns {Function}
			 */
			function writer (_stream) {
				return function (chunk) {
					_stream.write(svgTag.open)
					_stream.write('<style>\n' + styleStore.compile() + '\n</style>\n')
					_stream.write(chunk)
					_stream.write(svgTag.close)
				}
			}

			var fn = outPath ?
								writer(fs.createWriteStream(outPath, { flags : 'w' })) :
								writer(process.stdout)

			return concat({encoding: 'string'}, fn)
		}

		// magic
		spigot(matches)
			.pipe(through2.obj(parseFile))
			.pipe(through2.obj(extractStyle, function (cb) {
				// flush the stream
				// this prevents a race condition where
				// styles were being compiled before they were stored
				// 
				// There's probably a better way to do this, but I'm
				// no expert on streams
				cb()
			}))
			.pipe(through2.obj(createSymbol))
			.pipe(getWriteStream())

	})
} else {
	process.stdout.write('.svg path required')
}