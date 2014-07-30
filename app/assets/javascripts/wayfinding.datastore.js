WayfindingDataStore = {
  dataStore: {
    'paths': [],
    'portals': []
  },
  portalSegments: [],
  accessible: false,

  cleanupSVG: function (el) {
  	// clean up after illustrator -> svg issues
  	$('#Rooms a, #Doors line', el).each(function () {
  		if ($(this).prop('id') && $(this).prop('id').indexOf('_') > 0) {
  			var oldID = $(this).prop('id');
  			$(this).prop('id', oldID.slice(0, oldID.indexOf('_')));
  		}
  	});
  }, //function cleanupSVG

  // Extract data from the svg maps
  buildDataStore: function (mapNum, map, el) {

  	var path,
  		doorId,
  		x1,
  		y1,
  		x2,
  		y2,
  		matches,
  		portal,
  		portalId;

  	//Paths

  	WayfindingDataStore.dataStore.paths[mapNum] = [];

  	$('#Paths line', el).each(function () { // index, line
  		path = {};
  		path.floor = map.id; // floor_1
  		path.mapNum = mapNum; // index of floor in array 1
  		path.route = Infinity; //Distance
  		path.prior = -1; //Prior node in path that yielded route distance
  		path.ax = $(this).prop('x1').animVal.value;
  		path.ay = $(this).prop('y1').animVal.value;
  		path.doorA = [];
  		path.bx = $(this).prop('x2').animVal.value;
  		path.by = $(this).prop('y2').animVal.value;
  		path.doorB = [];
  		path.length = Math.sqrt(Math.pow(path.ax - path.bx, 2) + Math.pow(path.ay - path.by, 2));

  		path.connections = []; //other paths
  		path.portals = []; // connected portals

  		WayfindingDataStore.dataStore.paths[mapNum].push(path);
  	});

  	//Doors and starting points
  	//roomId or POI_Id

  	$('#Doors line', el).each(function () { // index, line
  		x1 = $(this).prop('x1').animVal.value;
  		y1 = $(this).prop('y1').animVal.value;
  		x2 = $(this).prop('x2').animVal.value;
  		y2 = $(this).prop('y2').animVal.value;
  		doorId = $(this).prop('id');

  		$.each(WayfindingDataStore.dataStore.paths[mapNum], function (index, path) {
  			if (map.id === path.floor && ((path.ax === x1 && path.ay === y1) || (path.ax === x2 && path.ay === y2))) {
  				path.doorA.push(doorId);
  			} else if (map.id === path.floor && ((path.bx === x1 && path.by === y1) || (path.bx === x2 && path.by === y2))) {
  				path.doorB.push(doorId);
  			}
  		});

  	});

  	//Portal Segments -- string theory says unmatched portal segment useless -- no wormhole

  	$('#Portals line', el).each(function () { // index, line
  		portal = {};

  		portalId = $(this).prop('id');

  		if (portalId && portalId.indexOf('_') > -1) {
  			portalId = portalId.slice(0, portalId.indexOf('_'));
  		}

  		portal.id = portalId;
  		portal.type = portalId.split('.')[0];
  		portal.floor = map.id;

  		portal.mate = portalId.split('.').slice(0, 2).join('.') + '.' + map.id;

  		portal.mapNum = mapNum;

  		portal.matched = false;

  		x1 = $(this).prop('x1').animVal.value;
  		y1 = $(this).prop('y1').animVal.value;
  		x2 = $(this).prop('x2').animVal.value;
  		y2 = $(this).prop('y2').animVal.value;

  		matches = $.grep(WayfindingDataStore.dataStore.paths[mapNum], function (n) { // , i
  			return ((x1 === n.ax && y1 === n.ay) || (x1 === n.bx && y1 === n.by));
  		});

  		if (matches.length !== 0) {
  			portal.x = x1;
  			portal.y = y1;
  		} else {
  			portal.x = x2;
  			portal.y = y2;
  		}

  		//portal needs length -- long stairs versus elevator
  		portal.length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

  		WayfindingDataStore.portalSegments.push(portal);

  	});
  }, // function finishfloor

	// after data extracted from all svg maps then build portals between them
	buildPortals: function (maps) {

		var segmentOuterNum,
			segmentInnerNum,
			outerSegment,
			innerSegment,
			portal,
			mapNum,
			pathOuterNum,
			pathInnerNum,
			portalNum,
			pathNum;

		for (segmentOuterNum = 0; segmentOuterNum < WayfindingDataStore.portalSegments.length; segmentOuterNum++) {

			outerSegment = WayfindingDataStore.portalSegments[segmentOuterNum];

			if (outerSegment.matched === false) {

				for (segmentInnerNum = segmentOuterNum; segmentInnerNum < WayfindingDataStore.portalSegments.length; segmentInnerNum++) {
					if (WayfindingDataStore.portalSegments[segmentInnerNum].id === outerSegment.mate && WayfindingDataStore.portalSegments[segmentInnerNum].mate === outerSegment.id) {
						innerSegment = WayfindingDataStore.portalSegments[segmentInnerNum];

						portal = {};

						outerSegment.matched = true;
						innerSegment.matched = true;

						portal.type = outerSegment.type;
						portal.accessible = (portal.type === 'Elev' || portal.type === 'Door') ? true : false; // consider changing to != Stair

						portal.idA = outerSegment.id;
						portal.floorA = outerSegment.floor;
						portal.floorANum = outerSegment.mapNum;
						portal.xA = outerSegment.x;
						portal.yA = outerSegment.y;
						portal.connectionsA = []; //only paths

						portal.idB = innerSegment.id;
						portal.floorB = innerSegment.floor;
						portal.floorBNum = innerSegment.mapNum;
						portal.xB = innerSegment.x;
						portal.yB = innerSegment.y;
						portal.connectionsB = []; // only paths

						portal.length = outerSegment.length + innerSegment.length;

						portal.route = Infinity;
						portal.prior = -1;

						WayfindingDataStore.dataStore.portals.push(portal);

					}
				}
			}
		}

		//check each path for connections to other paths
		//checks only possible matchs on same floor, and only for half-1 triangle of search area to speed up search
		for (mapNum = 0; mapNum < maps.length; mapNum++) {
			for (pathOuterNum = 0; pathOuterNum < WayfindingDataStore.dataStore.paths[mapNum].length - 1; pathOuterNum++) {
				for (pathInnerNum = pathOuterNum + 1; pathInnerNum < WayfindingDataStore.dataStore.paths[mapNum].length; pathInnerNum++) {
					if (
						(WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].ax === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].ax &&
						WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].ay === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].ay) ||
							(WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].bx === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].ax &&
								WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].by === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].ay) ||
							(WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].ax === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].bx &&
								WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].ay === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].by) ||
							(WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].bx === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].bx &&
								WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].by === WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].by)
					) {
						WayfindingDataStore.dataStore.paths[mapNum][pathOuterNum].connections.push(pathInnerNum);
						WayfindingDataStore.dataStore.paths[mapNum][pathInnerNum].connections.push(pathOuterNum);
					}
				}
			}
		}

		//optimize portal searching of paths
		for (portalNum = 0; portalNum < WayfindingDataStore.dataStore.portals.length; portalNum++) {
			for (mapNum = 0; mapNum < maps.length; mapNum++) {
				for (pathNum = 0; pathNum < WayfindingDataStore.dataStore.paths[mapNum].length; pathNum++) {
					if (WayfindingDataStore.dataStore.portals[portalNum].floorA === WayfindingDataStore.dataStore.paths[mapNum][pathNum].floor &&
							((WayfindingDataStore.dataStore.portals[portalNum].xA === WayfindingDataStore.dataStore.paths[mapNum][pathNum].ax &&
								WayfindingDataStore.dataStore.portals[portalNum].yA === WayfindingDataStore.dataStore.paths[mapNum][pathNum].ay) ||
								(WayfindingDataStore.dataStore.portals[portalNum].xA === WayfindingDataStore.dataStore.paths[mapNum][pathNum].bx &&
									WayfindingDataStore.dataStore.portals[portalNum].yA === WayfindingDataStore.dataStore.paths[mapNum][pathNum].by))) {
						WayfindingDataStore.dataStore.portals[portalNum].connectionsA.push(pathNum);
						WayfindingDataStore.dataStore.paths[mapNum][pathNum].portals.push(portalNum);
					} else if (WayfindingDataStore.dataStore.portals[portalNum].floorB === WayfindingDataStore.dataStore.paths[mapNum][pathNum].floor &&
							((WayfindingDataStore.dataStore.portals[portalNum].xB === WayfindingDataStore.dataStore.paths[mapNum][pathNum].ax &&
								WayfindingDataStore.dataStore.portals[portalNum].yB === WayfindingDataStore.dataStore.paths[mapNum][pathNum].ay) ||
							(WayfindingDataStore.dataStore.portals[portalNum].xB === WayfindingDataStore.dataStore.paths[mapNum][pathNum].bx &&
								WayfindingDataStore.dataStore.portals[portalNum].yB === WayfindingDataStore.dataStore.paths[mapNum][pathNum].by))) {
						WayfindingDataStore.dataStore.portals[portalNum].connectionsB.push(pathNum);
						WayfindingDataStore.dataStore.paths[mapNum][pathNum].portals.push(portalNum);
					}
				}
			}
		}

		WayfindingDataStore.portalSegments = [];

	},   // end function buildportals

  generateRoutes: function (startpoint, maps) {
    var sourceInfo,
    mapNum,
    sourcemapNum;

    sourceInfo = WayfindingDataStore.getDoorPaths(maps, startpoint);

    for (mapNum = 0; mapNum < maps.length; mapNum++) {
      if (maps[mapNum].id === sourceInfo.floor) {
        sourcemapNum = mapNum;
      }
    }

    $.each(sourceInfo.paths, function (i, pathId) {
      WayfindingDataStore.dataStore.paths[sourcemapNum][pathId].route = WayfindingDataStore.dataStore.paths[sourcemapNum][pathId].length;
      WayfindingDataStore.dataStore.paths[sourcemapNum][pathId].prior = 'door';
      WayfindingDataStore.recursiveSearch('pa', sourcemapNum, pathId, WayfindingDataStore.dataStore.paths[sourcemapNum][pathId].length);
    });
  },

  recursiveSearch: function (segmentType, segmentFloor, segment, length) {
    //SegmentType is PAth or POrtal, segment floor limits search, segment is id per type and floor, length is total length of current thread
    // for each path on this floor look at all the paths we know connect to it
    $.each(WayfindingDataStore.dataStore.paths[segmentFloor][segment].connections, function (i, tryPath) {
      // check and see if the current path is a shorter path to the new path
      if (length + WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].length < WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].route) {
        WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].route = length + WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].length;
        WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].prior = segment;
        WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].priorType = segmentType;
        WayfindingDataStore.recursiveSearch('pa', segmentFloor,  tryPath, WayfindingDataStore.dataStore.paths[segmentFloor][tryPath].route);
      }
    });
    // if the current path is connected to any portals
    if (WayfindingDataStore.dataStore.paths[segmentFloor][segment].portals.length > 0) {
      // look at each portal, tryPortal is portal index in portals
      $.each(WayfindingDataStore.dataStore.paths[segmentFloor][segment].portals, function (i, tryPortal) {
        if (length + WayfindingDataStore.dataStore.portals[tryPortal].length < WayfindingDataStore.dataStore.portals[tryPortal].route && (WayfindingDataStore.accessible === false || (WayfindingDataStore.accessible === true && WayfindingDataStore.dataStore.portals[tryPortal].accessible))) {
          WayfindingDataStore.dataStore.portals[tryPortal].route = length + WayfindingDataStore.dataStore.portals[tryPortal].length;
          WayfindingDataStore.dataStore.portals[tryPortal].prior = segment;
          WayfindingDataStore.dataStore.portals[tryPortal].priormapNum = WayfindingDataStore.dataStore.paths[segmentFloor][segment].mapNum;
          WayfindingDataStore.dataStore.portals[tryPortal].priorType = segmentType;
          // if the incoming segment to the portal is at one end of the portal try all the paths at the other end
          if ($.inArray(segment, WayfindingDataStore.dataStore.portals[tryPortal].connectionsA) !== -1) {
            $.each(WayfindingDataStore.dataStore.portals[tryPortal].connectionsB, function (i, tryPath) {
              //if adding this path
              if (length + WayfindingDataStore.dataStore.portals[tryPortal].length + WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].length < WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].route) {
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].route = WayfindingDataStore.dataStore.portals[tryPortal].route + WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].length;
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].prior = tryPortal;
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].priorType = 'po';
                WayfindingDataStore.recursiveSearch('pa', WayfindingDataStore.dataStore.portals[tryPortal].floorBNum, tryPath, WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorBNum][tryPath].route);
              }
            });
          } else {
            $.each(WayfindingDataStore.dataStore.portals[tryPortal].connectionsA, function (i, tryPath) {
              // if adding this path
              if (length + WayfindingDataStore.dataStore.portals[tryPortal].length + WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].length < WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].route) {
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].route = WayfindingDataStore.dataStore.portals[tryPortal].route + WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].length;
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].prior = tryPortal;
                WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].priorType = 'po';
                WayfindingDataStore.recursiveSearch('pa', WayfindingDataStore.dataStore.portals[tryPortal].floorANum, tryPath, WayfindingDataStore.dataStore.paths[WayfindingDataStore.dataStore.portals[tryPortal].floorANum][tryPath].route);
              }
            });
          }
        }
      });
    }
  },

  //get the set of paths adjacent to a door or endpoint.
  getDoorPaths: function (maps, door) {
    var mapNum,
    pathNum,
    doorANum,
    doorBNum,
    result = {
      'paths' : [],
      'floor' : null
    };

    for (mapNum = 0; mapNum < maps.length; mapNum++) {
      for (pathNum = 0; pathNum < WayfindingDataStore.dataStore.paths[mapNum].length; pathNum++) {
        for (doorANum = 0; doorANum < WayfindingDataStore.dataStore.paths[mapNum][pathNum].doorA.length; doorANum++) {
          if (WayfindingDataStore.dataStore.paths[mapNum][pathNum].doorA[doorANum] === door) {
            result.paths.push(pathNum); // only pushing pathNum because starting on a single floor
            result.floor = WayfindingDataStore.dataStore.paths[mapNum][pathNum].floor;
          }
        }
        for (doorBNum = 0; doorBNum < WayfindingDataStore.dataStore.paths[mapNum][pathNum].doorB.length; doorBNum++) {
          if (WayfindingDataStore.dataStore.paths[mapNum][pathNum].doorB[doorBNum] === door) {
            result.paths.push(pathNum); // only pushing pathNum because starting on a single floor
            result.floor = WayfindingDataStore.dataStore.paths[mapNum][pathNum].floor;
          }
        }
      }
    }

    return result;
  },

  build: function (startpoint, maps, accessible) {
    if(accessible == undefined) accessible = false;
    WayfindingDataStore.accessible = accessible;

    $.each(maps, function(i, map) {
      WayfindingDataStore.cleanupSVG(map.el);
      WayfindingDataStore.buildDataStore(i, map, map.el);
    });

    WayfindingDataStore.buildPortals(maps);

    WayfindingDataStore.generateRoutes(startpoint, maps);

    return WayfindingDataStore.dataStore;
  } // function build
}