var gulp = require('gulp');
var pkg = require('./package.json');
var fs = require('fs');
var path = require('path');
var merge = require('merge-stream');
var rename = require('gulp-rename');
var filesize = require('gulp-size');
var inject = require('gulp-inject');
var concat = require('gulp-concat');
var spritesmith = require('gulp.spritesmith');
var imagemin = require('gulp-imagemin');
var wait = require('gulp-wait');
var replace = require('gulp-replace');
var argv = require('yargs').argv;

function getFolders(dir) {
    return fs.readdirSync(dir)
      .filter(function(file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
}

function makesprite(variant, size) {
	var folder = variant + '/' + size + '/';
	var origin = 'src/variants/' + folder;
	var dest = origin;

	var spriteData = gulp.src(origin + 'assets/sprites/*.*') // source path of the sprite images
	.pipe(spritesmith({
        imgName: 'txtsprite.png',
        imgPath: 'assets/txtsprite.png',
        cssName: 'txtsprite.css',
        padding: 1
	}));

    spriteData.css.pipe(gulp.dest(dest)); // output path for the CSS

    var imgStream = spriteData.img
    	.pipe(imagemin()) // compress PNG
    	.pipe(gulp.dest(dest + 'assets/')); // output path for the sprite
}

gulp.task('default', function() {
  // place code for your default task here
  console.info('version: ' + pkg.version);
});

// Cleans the dist and dev folders
gulp.task('clean', function (callback) {
	var del = require('del');

	del(['dist/**/*', 'dev/**/*'],callback);
});

/** take the src folder, iterate over the structure to two depths assuming: first level = variants, second level = sizes.
    you can pass arguments on the command line -v to specify a single variant and -s to specify a single size. These
    arguments can be used together or seperately
    @param -v [variant folder name] (optional)
	@param -s [size folder name] (optional)
	@usage gulp makesprites -v myvariant -s mysize
**/
gulp.task('makesprites', function() {
	var variants = (argv.v === undefined) ? getFolders('src/variants/') : [argv.v];

	for (var i=0, vl=variants.length; i < vl; i++) {
		var variant = variants[i];
		var sizes = (argv.s === undefined) ? getFolders('src/variants/' + variant): [argv.s];

		for (var j=0, sl=sizes.length; j < sl; j++) {
			var size = sizes[j];
			if (size != 'tablet') {
				makesprite(variant, size);
			}
		}
	}
});

/*// create sprites for tablet version of susan variant only
gulp.task('makesusantabletsprites', function() {
	makesprite('susan','tablet');
});

// create sprites for tablet version of thomas variant only
gulp.task('makethomastabletsprites', function() {
	makesprite('thomas','tablet');
});*/

// take the src folder, iterate over the structure to two depths assuming: first level = variants, second level = sizes.
// builds the src files into the dev folder. Concats JS and css
gulp.task('build', ['clean'], function (callback) {
	var variants = getFolders('src/variants/');
	var fullmerge = merge();

	for (var i=0, vl=variants.length; i < vl; i++) {
		var variant = variants[i];
		var sizes = getFolders('src/variants/' + variant);

		for (var j=0, sl=sizes.length; j < sl; j++) {
			var size = sizes[j];
			var folder = variant + '/' + size + '/';
			var origin = 'src/variants/' + folder;
			var dest = 'dev/' + folder;
			var merged = merge();

			// move images
			var imageStream = gulp.src(['src/global/assets/**', origin + 'assets/**', '!' + origin + 'assets/sprites/', '!' + origin + 'assets/sprites/**'])
				.pipe(gulp.dest(dest + 'assets/'))

			// concat the styles
			var styleStream = gulp.src(['src/global/styles/*.css', origin + '*.css'])
				.pipe(concat('screen.css'))
				.pipe(gulp.dest(dest));
			merged.add(styleStream);

			// concat the javascript
			var scriptStream = gulp.src(['src/global/scripts/**/*.js', origin + '*.js'])
				.pipe(concat('scripts.min.js'))
				.pipe(gulp.dest(dest));
			merged.add(scriptStream);

			// inject the style and JS as well as meta info
			var injectStream = gulp.src(origin + '*.html')
			.pipe ( inject(merged, {ignorePath: dest, addRootSlash: false}))
			.pipe ( replace('{{author}}', pkg.author))
			.pipe ( replace('{{description}}', pkg.description))
			.pipe ( replace('{{version}}', pkg.version))
			.pipe ( replace('{{title}}', pkg.meta.client + " " + pkg.meta.campaign + " | " + variant + " | " + size + " | " + pkg.version))
			.pipe ( replace('{{width}}', size.substring(0,size.indexOf('x'))))
			.pipe ( replace('{{height}}', size.substring(size.indexOf('x')+1, size.length)))
			.pipe ( gulp.dest(dest))
			.pipe(wait(100)); // insert a slight pause so the file system can write successfully before we zip if this task is part of the zip chain

			fullmerge.add(injectStream);
		}
	}

	return fullmerge;
});



// take the src folder, iterate over the structure to two depths assuming: first level = variants, second level = sizes.
// create zips per size for each variant and place in the dist folder
gulp.task('zip', ['build'], function (callback) {
	var zip = require('gulp-zip');					// zip files
	// var date = new Date().toISOString().replace(/[^0-9]/g, '');
	var merged = merge();
	var variants = getFolders('dev/');

	for (var i=0, vl=variants.length; i < vl; i++) {
		var variant = variants[i];
		var sizes = getFolders('dev/' + variant);

		for (var j=0, sl=sizes.length; j < sl; j++) {
			var size = sizes[j];
			var folder = 'dev/' + variant + '/' + size + '/';
			var filename = pkg.meta.client + ' ' + pkg.meta.campaign + " " + variant + " " + size + " v" + pkg.version + ".zip";

			//console.info(filename);

			// keep directory structure
			var zipStream = gulp.src(folder + '**/*')
			.pipe ( zip(filename))
			.pipe ( filesize({title:filename, showFiles:true}))
			.pipe ( gulp.dest('dist'));

			merged.add(zipStream);
		}
	}

	return merged;
});
