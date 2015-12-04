/*
	Dynamically generate projects from JSON for Parallelism by HTML5 UP
	Christian Frisson
	MIT licensed
*/

function initProjects(thumbHeight){
    d3.json("projects.json",function(error,data){
        var article = d3.select("#reel")
        .selectAll("item thumb")
        .data(data.projects)
        .enter()
        .append(function(d) { 
            return document.createElement("article");
        })
        .attr("data-width",function(d){
            return (d.thumb.width * thumbHeight / d.thumb.height);
        })
        .attr("class","item thumb")
        article.append(function(d) { 
            var h2 = document.createElement("h2");
            var innerHTML = d.title;
            innerHTML += " (";
            if(d.eventName !== undefined){
                innerHTML += d.eventName;
            }
            if(d.eventName !== undefined && d.eventYear !== undefined){
                innerHTML += " ";
            }
            if(d.eventYear !== undefined){
                innerHTML += d.eventYear;
            }
            innerHTML += ")";
            h2.innerHTML = innerHTML;
            return h2;
        });
        article.append(function(d) { 
            var a = document.createElement("a");
            a.className="image";
            if(d.video !== undefined ){
                a.href = "http://vimeo.com/" + d.video.id;
                a.setAttribute("data-poptrox","vimeo,800x480");                                
            }
            else if(d.image !== undefined ){
                a.href = "images/fulls/" + d.image.stem;
            }
            else{
                a.href = "images/fulls/" + d.thumb.stem;
            }
            return a;
        })
            .append(function(d) { 
            var img = document.createElement("img");
            if(d.thumb.stem !== undefined)
                img.src = "images/thumbs/" + d.thumb.stem;
            return img;
        })
    });   
};