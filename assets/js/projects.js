/*
	Dynamically generate projects from JSON for Parallelism by HTML5 UP
	Christian Frisson
	MIT licensed
*/

function initProjects(thumbHeight) {
    d3.json("projects.json", function(error, data) {
        if (error) console.log(error)
            //var people = data.people;
        var article = d3.select("#reel")
            .selectAll("item thumb")
            .data(data.projects)
            .enter()
            .append(function(d) {
                return document.createElement("article");
            })
            .attr("data-width", function(d) {
                return (d.thumb.width * thumbHeight / d.thumb.height);
            })
            .attr("class", "item thumb")
        article.append(function(d) {
            var h2 = document.createElement("h2");
            var innerHTML = d.title;
            innerHTML += " (";
            if (d.eventName !== undefined) {
                innerHTML += d.eventName;
            }
            if (d.eventName !== undefined && d.eventYear !== undefined) {
                innerHTML += " ";
            }
            if (d.eventYear !== undefined) {
                innerHTML += d.eventYear;
            }
            innerHTML += ")";
            h2.innerHTML = innerHTML;
            return h2;
        });
        article.append(function(d) {
                var a = document.createElement("a");
                a.className = "image";
                if (d.video !== undefined) {
                    a.href = "http://vimeo.com/" + d.video.id;
                    a.setAttribute("data-poptrox", "vimeo,800x480");
                } else if (d.image !== undefined) {
                    a.href = "images/fulls/" + d.image.stem;
                } else {
                    a.href = "images/fulls/" + d.thumb.stem;
                }
                return a;
            })
            .append(function(d) {
                var img = document.createElement("img");
                if (d.thumb.stem !== undefined)
                    img.src = "images/thumbs/" + d.thumb.stem;
                // Pass caption to poptrox
                d.caption = "";

                /*d.caption += "<i class='icon fa-";
                d.caption += "sticky-note"
                d.caption +="'></i> ";
                d.caption +="project: ";*/

                d.caption += d.title;

                if (d.publications === undefined) {
                    d.caption += " (";
                    if (d.eventName !== undefined) {
                        d.caption += d.eventName;
                    }
                    if (d.eventName !== undefined && d.eventYear !== undefined) {
                        d.caption += " ";
                    }
                    if (d.eventYear !== undefined) {
                        d.caption += d.eventYear;
                    }
                    d.caption += ")";
                    d.caption += "<ul>"
                    if (d.subtitle !== undefined) {
                        d.caption += "<li>" + d.subtitle + "</li>";
                    }
                } else {
                    if (d.subtitle !== undefined) {
                        d.caption += ": " + d.subtitle;
                    }
                    d.caption += "<ul>"
                }

                var thesis = false;
                if (d.publications !== undefined) {
                    d.caption += "<li>"
                    d.caption += "<i class='icon fa-";
                    d.caption += "info-circle"
                    d.caption += "'></i> ";
                    d.caption += "dissemination: ";
                    d.publications.forEach(function(publication, i) {
                        if (i > 0) {
                            d.caption += " and "
                        }
                        //if (publication.conference !== undefined) {

                        if (publication.type === "phdthesis") {
                            thesis = true;
                            d.caption += "PhD thesis";
                        } else if (publication.type !== undefined) {
                            d.caption += publication.type + " ";
                        }

                        if (publication.presentation !== undefined) {
                            d.caption += publication.presentation
                            if (publication.presentation === "oral") d.caption += " presentation"
                            d.caption += " "
                        }
                        if (publication.conference !== undefined) {
                            d.caption += "at ";
                            if (publication.conference.split("ACM").length === 1) {
                                d.caption += "the ";
                            }
                            d.caption += publication.conference;
                            if (publication.series !== undefined && publication.series !== publication.conference) {
                                d.caption += " ("
                                d.caption += publication.series;
                                //d.caption += ")"
                            }
                            if (publication.year !== undefined && publication.year.toString().length === 4) {
                                //d.caption += " " + publication.year;
                                d.caption += "'";
                                d.caption += publication.year.toString().charAt(2);
                                d.caption += publication.year.toString().charAt(3);
                            }
                            if (publication.series !== undefined && publication.series !== publication.conference) {
                                d.caption += ")"
                            }

                            if (publication.acmDLAuthorizeId !== undefined) {

                                d.caption += ' <a href="http://dl.acm.org/authorize?'
                                d.caption += publication.acmDLAuthorizeId
                                d.caption += '" title="ACM DL Author-ize service">'
                                d.caption += '<img src="http://dl.acm.org/images/oa.gif" width="20" height="20" border="0" alt="[ACM-DL]" style="vertical-align:middle"/></a>';
                            }
                        } else if (publication.university !== undefined) {
                            d.caption += " at ";
                            d.caption += publication.university;
                            if (publication.year !== undefined) {
                                d.caption += " (" + publication.year + ")";
                            }
                        }
                        /*if(publication.location !== undefined){
                            if(publication.location.city !== undefined){
                                d.caption += ", " + publication.location.city;
                            }
                            if(publication.location.country !== undefined){
                                d.caption += ", " + publication.location.country;
                            }
                        }*/

                        //}
                    });
                    d.caption += "</li>";
                }

                /*if (d.dataset !== undefined) {
                    d.caption += "<li>"
                    d.caption += "<i class='icon fa-";
                    d.caption += "database"
                    d.caption += "'></i> ";
                    d.caption += "dataset: " + d.dataset + "</li>";
                }*/

                if (d.people !== undefined) {
                    d.caption += "<li>";
                    d.caption += "<i class='icon fa-";
                    d.caption += "users"
                    d.caption += "'></i> ";
                    d.caption += (thesis ? "jury: " : "in collaboration with: ");
                    for (var n = 0; n < d.people.length; n++) {
                        if (d.people[n][0] !== "Christian" && d.people[n][1] !== "Frisson") {
                            /*var author= people.find(
							function(e){
								if(d.people[n][0] == e.given && d.people[n][1] == e.family){
									return e;
								}
							});
						if(author !== undefined){
	                        d.caption += author.given;
	                        d.caption += " ";
	                        d.caption += author.family;
	                        if(n<d.people.length-1){
	                            d.caption += ", ";
	                        }
						}*/
                            if (d.people[n][0] !== undefined && d.people[n][1] !== undefined) {
                                d.caption += d.people[n][0];
                                d.caption += " ";
                                d.caption += d.people[n][1];
                                if (n < d.people.length - 1) {
                                    d.caption += ", ";
                                }
                            }


                        }
                    }
                    d.caption += "</li>";
                }

                if (d.contribs !== undefined) {
                    //d.caption += "<li>contributions: " + d.contribs + "</li>";
                    d.caption += "<li>"

                    d.caption += "<i title='"
                    d.caption += "my contributions: ";
                    d.caption += "' class='icon fa-";
                    d.caption += "briefcase"
                    d.caption += "'></i> my contributions: ";


                    //d.caption += "<ul>"
                    d.contribs.forEach(function(contrib, i) {
                        if (i > 0) d.caption += ",";
                        if (i === d.contribs.length - 1) d.caption += "</li><li>"
                            //d.caption += "<li>"; 
                        d.caption += " ";

                        if (contrib.type === "development") {
                            d.caption += "<i title='"
                            d.caption += "development";
                            d.caption += "' class='icon fa-";
                            d.caption += "code"
                            d.caption += "'></i>";

                            if (d.code !== undefined && d.code.host === "github") {
                                var url = "https://github.com/" + d.code.account + "/"
                                if (d.code.repo !== undefined) url += d.code.repo;
                                d.caption += " <a href='" + url + "' title='"
                                d.caption += url
                                d.caption += "' class='icon fa-github'>";
                                d.caption += "<span class='label'>Github</span>"
                                d.caption += "</a>";
                            }
                        } else {
                            d.caption += " <i title='" + contrib.type + "' class='icon fa-";
                            if (contrib.type === "organization") {
                                d.caption += "sitemap"
                            } else if (contrib.type === "design") {
                                d.caption += "lightbulb-o"
                            }
                            d.caption += "'></i>";
                        }
                        d.caption += " ";
                        //d.caption += "(";
                        d.caption += contrib.desc;
                        //d.caption += ")";
                        //d.caption += "<li>";     
                    });
                    d.caption += "</ul>"
                    d.caption += "</li>";
                }
                d.caption += "</ul>"
                return img;
            })
    });
};