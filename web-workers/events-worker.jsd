importScripts('eventsource.min.js');

// Main.

var self = this;

var checkESTimer;
var eventSource, eventSourceURL;
var eventMonitorOpen, lastMessageReceivedTime, lastOpenTime;

function onEventSourceMessage(message) {

    lastMessageReceivedTime = new Date().getTime();

    self.postMessage(message.data);

}

function receiveMessage(message) {

    var data = JSON.parse(message.data);
    switch (data[0]) {

        case 'start':

            eventSourceURL = data[1].url;
            openEventMonitor();
            startCheckESTimer();

            break;

        case 'stop':
            stopCheckESTimer();

            if (eventSource)
                eventSource.close();

            break;


    }

}

self.addEventListener('message', receiveMessage, false);

function openEventMonitor() {

    if (eventSource)
        eventSource.close();

    eventSource = new EventSource(eventSourceURL, {withCredentials: true});
    eventSource.addEventListener('message', onEventSourceMessage, false);

    eventSource.addEventListener('open',
        function () {
            console.log("EventMonitor.es open");

            eventMonitorOpen = true;
            lastOpenTime = new Date().getTime();
            lastMessageReceivedTime = new Date().getTime();

            self.postMessage(
                JSON.stringify({method: 'eventMonitorOpened'})
            );

        },
        false);

    eventSource.addEventListener('error',
        function (arg) {
            console.log("EventMonitor.es error");

            var timeDelta = new Date().getTime() - lastOpenTime;
            if (timeDelta < 10000) {
                console.log("Ignoring EventMonitor.es error");
            } else {
                eventMonitorOpen = false;
                self.postMessage(
                    JSON.stringify({method: 'eventMonitorClosed'})
                );
            }
        },
        false);

    eventSource.addEventListener('close',
        function (arg) {
            console.log("EventMonitor.es close");

            eventMonitorOpen = false;
            self.postMessage(
                JSON.stringify({method: 'eventMonitorClosed'})
            );
        },
        false);


}

function startCheckESTimer() {
    checkESTimer = setInterval(function () {

        if (eventSource) {
            var timeDelta = new Date().getTime() - lastMessageReceivedTime;
//                    console.debug("Elapsed time since last ES communication", timeDelta, "readyState", eventSource.readyState);
            if (timeDelta >= 32000) {
                console.warn("Elapsed time since last ES communication", timeDelta, "readyState", eventSource.readyState, "restarting the event source");

                openEventMonitor();
            }
        }


    }, 30000);
}

function stopCheckESTimer() {

    clearInterval(checkESTimer);
    checkESTimer = undefined;
}


