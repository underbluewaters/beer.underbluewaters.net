function updateDisplay(data){
  console.log('data', data);
  if (data.fermenter.temperature) {
    document.getElementById('fy').style.display = 'block';
    document.getElementById('fn').style.display = 'none';
  } else {
    document.getElementById('fy').style.display = 'none';
    document.getElementById('fn').style.display = 'block';
  }
  document.getElementById('ft').innerHTML = data.fermenter.temperature;
  document.getElementById('fc').className = data.fermenter.compressor ? 'compressor on' : 'compressor off';
  if (data.keezer.temperature) {
    document.getElementById('ky').style.display = 'block';
    document.getElementById('kn').style.display = 'none';
  } else {
    document.getElementById('ky').style.display = 'none';
    document.getElementById('kn').style.display = 'block';
  }
  document.getElementById('kt').innerHTML = data.keezer.temperature;
  document.getElementById('kc').className = data.keezer.compressor ? 'compressor on' : 'compressor off';
}

function drawHourlySparkline(type, data){
  var height = 30;
  var width = 30;
  var selector = '.sparkline-small.'+type;
  d3.select(selector + ' svg').remove();
  d3.select(selector).append("svg:svg").attr("width", width+"px").attr("height", height+"px");
  var graph = d3.select(selector + ' svg');
  var x = d3.scale.linear().domain([0, data.length]).range([0, width]);
  var y = d3.scale.linear().domain([d3.max(data) + 2, d3.min(data) - 2]).range([0, height + 3]);

  var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  var line = d3.svg.line()
    .x(function(d,i) {
      return x(i);
    })
    .y(y)

  graph.append("svg:path").attr("d", line(data));
  graph.append("svg:circle")
    .attr('cx', x(data.length))
    .attr('cy', y(data[data.length - 1]))
    .attr('r', 1)


  graph.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("° F");
}


function drawDailySparkline(type, data){
  var height = 35;
  var width = 300;
  var selector = '.sparkline-large.'+type;
  d3.select(selector + ' svg').remove();
  d3.select(selector).append("svg:svg").attr("width", width+"px").attr("height", height+"px");
  var graph = d3.select(selector + ' svg');
  var x = d3.scale.linear().domain([0, data.length]).range([0, width - 0]);
  var y = d3.scale.linear().domain([d3.max(data) + 2, d3.min(data) - 2]).range([0, height]);
  var yAxis = d3.svg.axis()
    .scale(y)
    .orient('right')
    .ticks(3);

  var line = d3.svg.line()
    .x(function(d,i) {
      return x(i);
    })
    .y(y)

  graph.append("svg:path").attr("d", line(data));

  graph.append("g")
      .attr("class", "y axis")
      .call(yAxis)
}

function fetchData(type, duration, next) {
  d3.json("/last-"+duration+"/"+type, function(data){
    var temps = data.map(function(record){ return record.average; });
    temps.reverse()
    next(temps);
  });
}
