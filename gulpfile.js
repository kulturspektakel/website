const { src, dest, parallel } = require("gulp");
const sass = require("gulp-sass");
const concat = require("gulp-concat");
const uglify = require("gulp-uglify");
const cleanCSS = require("gulp-clean-css");
sass.compiler = require("node-sass");

function css() {
  return src("assets/scss/index.scss")
    .pipe(sass().on("error", sass.logError))
    .pipe(cleanCSS())
    .pipe(dest("assets/build"));
}

function fonts() {
  return src("./node_modules/font-awesome/fonts/*").pipe(
    dest("./assets/build")
  );
}

function js() {
  return src([
    "./node_modules/jquery/dist/jquery.min.js",
    "./node_modules/bootstrap-sass/assets/javascripts/bootstrap.js",
    "./node_modules/swipebox/src/js/jquery.swipebox.min.js",
    "./node_modules/jquery-sticky/jquery.sticky.js",
    "./node_modules/unveil2/dist/jquery.unveil2.min.js",
    "./node_modules/bootstrap-select/dist/js/bootstrap-select.min.js",
    "./node_modules/typeahead.js/dist/typeahead.jquery.min.js",
    "assets/js/index.js"
  ])
    .pipe(concat("index.js"))
    .pipe(uglify())
    .pipe(dest("./assets/build"));
}

exports.css = css;
exports.default = parallel(css, fonts, js);
