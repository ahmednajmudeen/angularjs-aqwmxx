$(function() {
  
  // define tour
  var tour = new Tour({
    debug: true,
  smartPlacement: true,
  keyboard: true,
  backdrop: true,
  backdropContainer: 'body',
  backdropPadding: 0,
    steps: [{
      // path: "/#!/app/home",
      element: "#step1",
      title: "Title of my step",
      content: "Content of my step"
    }, {
    
      element: "#step2",
      title: "Title of my step",
      content: "Content of my step"
    }],
	
	
	
	
	
	
	
  });

  // init tour
  tour.init();

  // start tour
  $('#start-tour').click(function() {
    tour.restart();
  });
  

});
