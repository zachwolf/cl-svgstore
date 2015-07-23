#! /usr/bin/env node
	
var glob     = require('glob')
	, fs       = require('fs')
	, path     = require('path')
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

if (inGlob) {
	glob(inGlob, function (err, matches) {

		if (err) throw new Error(err)

		var fetchHeader = once(function () {
			return '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">'
		})

		/**
		 * Converts a svg's file contents to a `<symbol>` tag
		 *
		 * @param {string} foo - foo description
		 * @param {string} foo - foo description
		 * @returns {string}
		 */
		function symbolTpl (filepath, raw) {
			var $        = cheerio.load(raw)
				, $svg     = $('svg')
				, filename = path.parse(filepath).name
				, contents = $svg.html()
				, viewBox  = $svg.attr('viewbox') || '0 0 1 1'

		  return '<symbol id="' + filename + '" viewBox="' + viewBox + '">' + contents + '</symbol>'
		}

		/**
		 * Converts a file to an svg <symbol> element
		 *
		 * @param {buffer} chunk - filename
		 * @param {number} index - foo description
		 * @param {function} cb - callback for when process is completed
		 * @returns {buffer}
		 */
		function parseFile (chunk, index, cb) {

			var self = this
				, filename = chunk.toString('utf-8')

			fs.readFile(filename, function (err, res) {
				if (err) throw new Error(err)

				var compiled = symbolTpl(filename, res.toString('utf-8'))

				self.push(compiled)
				cb()
			})
		}

		/**
		 * Adds opening svg tag
		 *
		 * @param {buffer} chunk
		 * @param {number} index
		 * @param {function} cb
		 */
		function addOpeningTag (chunk, index, cb) {
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
		function addClosingTag (cb) {
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
			.pipe(through2(parseFile))
			.pipe(through2(addOpeningTag, addClosingTag))
			.pipe(getWriteFn())

	})
} else {
	process.stdout.write('.svg path required')
}