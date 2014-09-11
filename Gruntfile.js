module.exports = function(grunt){
  grunt.initConfig({
    jshint: {
      all: ['src/**/*.js'],
      options: {
        globals: {
          _: false,
          $: false,
          jasmine: false,
          describe: false,
          it: false,
          expect: false,
          beforeEach: false
        },
        browser: true,
        devel: true,
      }
    },
    testem: {
      unit: {
        options: {
          framework: 'jasmine2',
          launch_in_dev: ['PhantomJS'],
          before_tests: 'grunt jshint',
          //testem will serve these files when running tests
          serve_files: [
            'node_modules/lodash/lodash.js',
            'node_modules/jquery/dist/jquery.js',
            'src/**/*.js',
            'test/**/*.js'
          ],
          // testem will watch for changes to these files
          watch_files: [
            'src/**/*.js',
            'test/**/*.js'
          ]
        }
      }
    }
  });
  //grunt will load this files that have been already saved to this project
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-testem');

  grunt.registerTask('default', ['testem:run:unit'])
};


