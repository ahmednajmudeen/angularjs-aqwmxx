$(function() {
  
  // define tour
  var tour = new Tour({
    debug: true,
 
  
    steps: [{
      // path: "/#!/app/home",
      element: "#step1",
      title: "Title of my step",
      content: "Content of my step",
	  placement:"bottom"
	
 


	   
	   
    }, 
	
	{    
    smartPlacement: true, backdropContainer: 'step2',
      element: "#step2",
      title: "Title of my step",
      content: "Content of my step"
    },
	
	{    
    smartPlacement: true, 
      element: "#step3",
      title: "Phone status",
      content: ' if this show <a style="color:red">OFFLINE</a>, please restart this softphone, </br> if its ONLINE, you are good to go'
    }
	
	
	
	
	],
	
	

	
  });

  // init tour
  tour.init();

  // start tour
  $('#start-tour').click(function() {
    tour.restart();
  });
  

});
