const { src, dest, parallel } = require("gulp");
const sass = require("gulp-sass");
const concat = require("gulp-concat");
const uglify = require("gulp-uglify");
sass.compiler = require("node-sass");

function css() {
  return src("assets/scss/index.scss")
    .pipe(sass().on("error", sass.logError))
    .pipe(dest("assets/build"));
}

function fonts() {
  return src("./node_modules/font-awesome/fonts/*").pipe(
    dest("./assets/build")
  );
}

function js() {
  return src([
    "./node_modules/jquery/dist/jquery.slim.min.js",
    "./node_modules/swipebox/src/js/jquery.swipebox.min.js",
    "assets/js/index.js"
  ])
    .pipe(concat("index.js"))
    .pipe(uglify())
    .pipe(dest("./assets/build"));
}

exports.css = css;
exports.default = parallel(css, fonts, js);
