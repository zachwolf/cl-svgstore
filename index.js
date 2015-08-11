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
 * a function to be called one time
 *
 * @param {function} fn - function to be called only one time
 * @returns {function}
 */
function once (fn) {
	var called = false
	return function () {
		if (!called) {
			called = true
			return fn()
		}
	}
}

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

		var fetchHeader = once(function () {
					return '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">'
				})
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
		 * Adds opening svg tag
		 *
		 * @param {buffer} chunk
		 * @param {number} index
		 * @param {function} cb
		 */
		function startFlattenStream (chunk, index, cb) {
			var header = fetchHeader()

			if (header) {
				this.push(header)
			}

			cb(null, chunk)
		}

		/**
		 * Adds closing svg tag
		 *
		 * @param {function} cb
		 */
		function finishFlattenStream (cb) {
			this.push('<style>' + styleStore.compile() + '</style>') // [] todo? - move this to a stream flush function
			this.push('</svg>')
			cb()
		}

		/**
		 * Conditionally write to a file or the console
		 *
		 * @returns {function}
		 */
		function getWriteFn () {
			if (outPath) {
				return fs.createWriteStream(outPath, { flags : 'w' })
			} else {
				return concat({encoding: 'string'}, function (chunk) {
					process.stdout.write(chunk)
				})
			}
		}

		// magic
		spigot(matches)
			.pipe(through2.obj(parseFile))
			.pipe(through2.obj(extractStyle))
			.pipe(through2.obj(createSymbol))
			.pipe(through2(startFlattenStream, finishFlattenStream))
			.pipe(getWriteFn())

	})
} else {
	process.stdout.write('.svg path required')
}