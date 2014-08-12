$(function(){
	$('.selectpicker').selectpicker();
	
	$('.bandlist a').click(function (e) {
		console.log("as");
		if (!$(this).parents("li").hasClass("active")) {
			e.preventDefault();
			$(this).parents("li").addClass("active");
		}
	});	
	$(".band-stage-close").click(function (e) {
		$(this).parents(".active").removeClass("active");
		e.preventDefault();
		e.stopPropagation();
	});
	
	$('.bandlist .band-image img').unveil();
	$('.bandlist .band-stage-name').tooltip();

	
	
});