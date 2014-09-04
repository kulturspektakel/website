var slider;
var rows = 2;
var imageWidth = 150;
var perRow;
var reverse = [];

$(function() {
	perRow = Math.ceil($("#instafeed").width()/imageWidth*2);
	slider = $("#instafeed");
	feed = "https://api.instagram.com/v1/users/479141788/media/recent/?client_id=c699fdcc7f3449dbb8a8d140ee68fb74&count="+rows*perRow+"&callback=?";

	$.getJSON(feed, function (feed) {
		feed.data = _.shuffle(feed.data);
		for (i=0;i<feed.data.length;i++) {
			if (i%perRow==0) {
				slider.append("<div class='slider-row'></div>");
			}
			$(_.last(slider.find(".slider-row"))).append("<img src='"+feed.data[i].images.thumbnail.url+"' />");
		}
		
		setInterval(function () {
			$('.slider-row').each(function (i) {
				_self = $(this);
				if (i%2==0)  {
					i = $($(this).find('img')[0]);
					i.animate({width:0}, function () {
						p = $(this).parent();
						$(this).detach().css('width','auto').appendTo(p);
					});
				} else {
					i = $(_.last($(this).find('img')));
					p = i.parent();
					i.css('width',0).detach().prependTo(p);
					i.animate({width:'150px'});
				}	
			});
		}, 5000);
			
	}).fail(function() {
		
	});
});