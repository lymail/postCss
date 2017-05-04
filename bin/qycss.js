#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    chokidar = require('chokidar'),
    colors = require('colors'),
    postcss = require('postcss'),
    autoprefixer = require('autoprefixer'),
    sprites = require('postcss-sprites'),
    precss = require('precss'),
    Spritesmith = require('spritesmith'),
    postcssClean = require('postcss-clean'),
    atImport = require("postcss-import"),
    setUp = require("../lib/PATHS");

var baseCon = {
    basePath: {
        BPostcss: RegExp(setUp.postcssName),
        BCss: RegExp(setUp.cssPa),
        setUpExp: RegExp(setUp.isPc)
    },
    reg: {
        version: /^v{1}(\d+\.\d+)/,
        node_modules: /node_modules/,
        iconFile: /(icon)-?([\w]*)/
    },
    utilTool: {
        mkdirs: function(dirname, callback) {
            //建立目录
            console.log(dirname)
            fs.exists(dirname, function(exists) {
                if (exists) {
                    callback();
                } else {
                    //console.log(path.dirname(dirname));
                    mkdirs(path.dirname(dirname), function() {
                        fs.mkdir(dirname, callback);
                    });
                }
            })
        }
    },

    postcssFun: {
        unitConversion: function(css) {

            css.walkRules(function(rule) {
                rule.walkDecls(function(decl, i) {
                    decl.value = decl.value.replace(/(\d*\.?\d+)rx/ig, function(str) {
                        return (parseFloat(str) / 2) + 'px';
                    })
                    decl.value = decl.value.replace(/(\d*\.?\d+)rm/ig, function(str) {
                        console.log(str)
                        return (parseFloat(str) / 100) + 'rem';
                    })
                })
            });
        }
    }
}

// 合图
function spritesFun(imgPat) {
    return {
        spritePath: imgPat,
        spritesmith: {
            padding: 30
        },
        filterBy: function(image) {
            var imgArr = path.basename(path.dirname(image.url));
            if (baseCon.reg.iconFile.test(image.url) && baseCon.reg.iconFile.test(imgArr)) {
                return Promise.resolve();
            }
            return Promise.reject();
        },
        groupBy: function(image) { //合图的文件名
            var ab = baseCon.reg.iconFile.exec(image.url);
            if (image.url.indexOf(ab[0]) === -1) {
                return Promise.reject(new Error('Not a shape image.'));
            }
            return Promise.resolve(ab[0]);
        },
        hooks: {
            onUpdateRule: function(rule, token, image) {

                var backgroundSizeX = (image.spriteWidth / image.coords.width) * 100,
                    backgroundSizeY = (image.spriteHeight / image.coords.height) * 100,
                    backgroundPositionX = (image.coords.x / (image.spriteWidth - image.coords.width)) * 100,
                    backgroundPositionY = (image.coords.y / (image.spriteHeight - image.coords.height)) * 100;

                backgroundSizeX = isNaN(backgroundSizeX) ? 0 : backgroundSizeX;
                backgroundSizeY = isNaN(backgroundSizeY) ? 0 : backgroundSizeY;
                backgroundPositionX = isNaN(backgroundPositionX) ? 0 : backgroundPositionX;
                backgroundPositionY = isNaN(backgroundPositionY) ? 0 : backgroundPositionY;


                if (baseCon.basePath.setUpExp.test(image.url)) {
                    var Imgwidth = postcss.decl({
                        prop: 'width',
                        value: image.coords.width + 'px'
                    });
                    var height = postcss.decl({
                        prop: 'height',
                        value: image.coords.height + 'px'
                    });
                } else {
                    var Imgwidth = postcss.decl({
                        prop: 'width',
                        value: image.coords.width / 2 + 'px'
                    });
                    var height = postcss.decl({
                        prop: 'height',
                        value: image.coords.height / 2 + 'px'
                    });
                }

                var backgroundImage = postcss.decl({
                    prop: 'background-image',
                    value: 'url(' + image.spriteUrl + ')'
                });

                var backgroundSize = postcss.decl({
                    prop: 'background-size',
                    value: backgroundSizeX + '% ' + backgroundSizeY + '%'
                });

                var backgroundPosition = postcss.decl({
                    prop: 'background-position',
                    value: backgroundPositionX + '% ' + backgroundPositionY + '%'
                });
                rule.insertAfter(token, Imgwidth)
                rule.insertAfter(Imgwidth, height);
                rule.insertAfter(height, backgroundImage);
                rule.insertAfter(backgroundImage, backgroundPosition);
                rule.insertAfter(backgroundPosition, backgroundSize);
            }
        }
    }
}

chokidar.watch(path.join(__dirname,'../'), {
    ignored: baseCon.reg.node_modules
}).on('all', (event, pat) => {
    console.log(pat)
    if (event == 'change' && baseCon.basePath.BPostcss.test(pat)) {
        var cssPath = pat.replace(baseCon.basePath.BPostcss, setUp.cssPa),
            cssStr = cssPath.replace(/\w*\.css/, ''),
            imgPat = cssStr.replace(baseCon.basePath.BCss, setUp.imgName),
            vreg = baseCon.reg.version,
            patArr = imgPat.split('/');
        patArr.map(item => {
            if (vreg.test(item)) {
                imgPat = path.join(imgPat, '../');
            }
        })
        baseCon.utilTool.mkdirs(cssStr, function(ee) {
            fs.readdir(path.dirname(pat), (err, files) => {
                files.forEach(function(file) {
                    if (/^_/.test(file)) return false;
                    var cssName = path.dirname(cssPath) + path.sep + file;
                    fs.readFile(path.dirname(pat) + path.sep + file, (err, css) => {
                        postcss([
                                atImport(),
                                baseCon.postcssFun.unitConversion,
                                sprites(spritesFun(imgPat)),
                                precss,
                                autoprefixer,
                                postcssClean()
                            ])
                            .process(css, {
                                from: path.dirname(pat) + path.sep + file,
                                to: cssName
                            })
                            .then(result => {
                                console.log(cssName.green);
                                fs.writeFile(cssName, result.css);
                            })
                            .catch((err) => {
                                console.log(err);
                            })
                    })
                })
            })
        })
    }
})
