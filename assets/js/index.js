App = {
  init: function() {
    this.isMobile = mq.matches;
    $('#logo, .nav-logo').mousedown(function(event) {
      if (event.which == 3) {
        window.location.href = '/logo';
        event.preventDefault();
      }
    });

    $('.mobile-nav').click(function() {
      $('.hero').toggleClass('active');
    });
  },

  lineup: function() {
    var yearSelector = $('.yearSelector');
    var stageSelector = App.isMobile
      ? $('.stageSelector-mobile')
      : $('.stageSelector input');
    var daySelector = App.isMobile ? $('.daySelector-mobile') : false;
    var STAGES = ['GB', 'KB', 'WB', 'A', 'DJ'];

    var applyLineupFilter = function(stageSelector, daySelector) {
      $('.bandlist li').hide();
      if (daySelector) {
        if (daySelector.val() !== '') {
          $('.day-col').hide();
          $('.day-' + daySelector.val()).show();
        } else {
          $('.day-col').show();
        }
      }

      var stageSelectorValue = stageSelector.filter(':checked').val();
      if (typeof stageSelectorValue === 'undefined') {
        stageSelectorValue = stageSelector.val();
      }

      stageSelector =
        stageSelectorValue !== ''
          ? '[data-stage=' + stageSelectorValue + ']'
          : '';
      $('.bandlist li' + stageSelector).show();
    };

    // hide unused stages
    STAGES.forEach(function(stage) {
      if ($('.bandlist li[data-stage=' + stage + ']').length === 0) {
        $('.stageSelector input[value=' + stage + ']')
          .parents('.stageSelector')
          .hide();
        $('select.stageSelector-mobile option[value=' + stage + ']').remove();
      }
    });

    $('.selectpicker').selectpicker();

    yearSelector.on('change', function() {
      document.location.href = yearSelector.val();
    });

    stageSelector.change(function() {
      $('.stageSelector label').removeClass('active');
      $(this)
        .parent('label')
        .addClass('active');
      applyLineupFilter(stageSelector, daySelector);
    });

    if (daySelector) {
      daySelector.change(function() {
        applyLineupFilter(stageSelector, daySelector);
      });
    }

    $('.bandlist li.has-content').click(function() {
      if (!$(this).hasClass('active')) {
        $(this).addClass('active');
      }
    });
    $('.bandlist .band-stage-close').click(function() {
      setTimeout(
        function() {
          $(this)
            .parents('.active')
            .removeClass('active');
        }.bind(this),
        0
      );
    });

    $('.bandlist .band-image img').unveil();
    // if (!App.isMobile) $(".bandlist .band-stage-name").tooltip();

    $('#bandsearch')
      .typeahead(
        {
          highlight: true
        },
        {
          display: function(o) {
            return o.title + ' (' + o.year + ')';
          },
          source: function(query, syncResults, asyncResults) {
            syncResults([]);
            fetch(
              'https://' +
                window.ALGOLIA_APP_ID +
                '-dsn.algolia.net/1/indexes/' +
                window.ALGOLIA_INDEX +
                '?query=' +
                query,
              {
                headers: {
                  'X-Algolia-API-Key': window.ALGOLIA_API_KEY,
                  'X-Algolia-Application-Id': window.ALGOLIA_APP_ID
                }
              }
            )
              .then(function(res) {
                return res.json();
              })
              .then(function(data) {
                return asyncResults(data.hits);
              });
          },
          templates: {
            empty: function(context) {
              $('.tt-dataset').html(
                '<div class="tt-suggestion">Keine Band gefunden</div>'
              );
            }
          }
        }
      )
      .bind('typeahead:select', function(obj, selected, name) {
        ga('send', 'search', selected.name);
        window.location = selected.url;
      });
    $('#q-bandsearch').click(function() {
      $('#searchcontrol').toggleClass('search-active');
      if ($('#searchcontrol').hasClass('search-active')) {
        $('.tt-input').focus();
        $('#q-bandsearch .fa')
          .removeClass('fa-search')
          .addClass('fa-times');
      } else {
        $('#q-bandsearch .fa')
          .removeClass('fa-times')
          .addClass('fa-search');
      }
    });

    // disable iPhone zoom on input focus
    if (App.isMobile) {
      var viewport = document.querySelector('meta[name=viewport]');
      var appendix = ', user-scalable=0';
      var disableZoom = function() {
        viewport.setAttribute(
          'content',
          viewport.getAttribute('content') + appendix
        );
      };
      var enableZoom = function() {
        viewport.setAttribute(
          'content',
          viewport.getAttribute('content').replace(appendix, '')
        );
      };
      $('#q-bandsearch').bind('touchstart', function() {
        if (viewport.getAttribute('content').indexOf(appendix) > -1) {
          enableZoom();
        } else {
          disableZoom();
        }
      });
      $('.tt-input').bind('blur', function() {
        enableZoom();
      });
    }
  },

  fotos: function() {
    $('.album a').swipebox();
    $('.album a[data-album]').click(function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = $(this).attr('data-album') + '#more';
    });
    $('.album img').unveil();
  },

  plakate: function() {
    $('.open-gallery').swipebox();
  },

  home: function() {
    if (App.isMobile) {
      $('.home .hero').sticky({
        topSpacing: -300
      });
    } else {
      $('.home .hero').sticky({
        topSpacing: -430
      });
      $(document).scroll(function() {
        $('.home .nav-logo').css(
          'left',
          Math.min($(document).scrollTop() - 520, 15)
        );
      });
    }
  }
};

$(function() {
  if (matchMedia) {
    mq = window.matchMedia('(max-width: 768px)');
    mq.addListener(App.init);
  }
  App.init();
  $.each($.trim($('body').attr('class')).split(/\s+/), function(i, c) {
    if (App[c]) App[c]();
  });
});
