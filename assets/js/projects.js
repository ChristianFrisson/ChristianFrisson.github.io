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
            var h3 = document.createElement("h3");
            var innerHTML = '';
            if (d.url !== undefined){
                innerHTML += "<a href=\""
                innerHTML += d.url
                innerHTML += "\">"
            }
            innerHTML += d.title;
            if (d.url !== undefined){
                innerHTML += "</a>"
            }
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

            if(d.publications !== undefined){
                var award = ( d.publications.filter(p => p.award !== undefined).length > 0 );
                if(award){
                    innerHTML += "";
                    innerHTML += "<i class='fas fa-";
                    innerHTML += "star"
                    innerHTML += "'></i> ";
                }
            }

            h3.innerHTML = innerHTML;
            return h3;
        });
        article.append(function(d) {
                var a = document.createElement("a");
                a.className = "image";
                if (d.image !== undefined && d.image.stem !== undefined) {
                    a.setAttribute("id", "link-"+d.image.stem.split(".")[0]);
                }
                if (d.video !== undefined) {
                    if (d.video.host === "vimeo"){
                        a.href = "http://vimeo.com/" + d.video.id;
                        a.setAttribute("data-poptrox", "vimeo,800x480");
                    }
                    else if (d.video.host === "youtube"){
                        a.href = "http://youtu.be/" + d.video.id;
                        a.setAttribute("data-poptrox", "youtube,800x480");
                    }
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

                if (d.url !== undefined){
                    d.caption += "<a href=\""
                    d.caption += d.url
                    d.caption += "\">"
                }
                d.caption += d.title;
                if (d.url !== undefined){
                    d.caption += "</a>"
                }

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
                    d.caption += "<i class='fas fa-";
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
                        if (publication.conference !== undefined || publication.journal !== undefined) {
                            if(publication.conference !== undefined){
                                d.caption += "at ";
                                // if (publication.conference.split("ACM").length === 1) {
                                //     d.caption += "the ";
                                // }
                                d.caption += publication.conference;
                            }
                            else if(publication.journal !== undefined){
                                d.caption += "in ";
                                d.caption += publication.journal;
                            } 
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

                            if (publication.acmDLAuthorizeId !== undefined && publication.doi !== undefined) {

                                // d.caption += ' <a href="https://dl.acm.org/authorize?'
                                // d.caption += publication.acmDLAuthorizeId
                                d.caption += ' <a href="https://dl.acm.org/doi/'
                                d.caption += publication.doi
                                d.caption += '?cid=81470641566'
                                d.caption += '" title="ACM DL Author-ize service">'
                                d.caption += '<img src="images/ACM-DL-Logo-flat-CMYK-no-text.svg.png" width="38" height="18" border="0" alt="[ACM-DL]" style="vertical-align:middle"/></a>';
                            }

                            if (publication.doi !== undefined) {

                                d.caption += ' <a href="https://doi.org/'
                                d.caption += publication.doi
                                d.caption += '" title="Digital Object Identifier (DOI)">'
                                d.caption += '<i class="fas fa-file-alt"></i></a>'
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

                    var awards = d.publications.filter(p => p.award !== undefined);
                    if(awards.length > 0){
                        var award = awards[0].award;
                        d.caption += "<li>"
                        d.caption += "<i class='fas fa-";
                        d.caption += "star"
                        d.caption += "'></i> ";
                        d.caption += "award: "
                        if (award.url !== undefined) d.caption += "<a href='" + award.url + "'>";
                        d.caption += award.title;
                        if (award.url !== undefined) d.caption += "</a>";
                        d.caption += "</li>";
                    }
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
                    d.caption += "<i class='fas fa-";
                    d.caption += "users"
                    d.caption += "'></i> ";
                    d.caption += (thesis ? "jury: " : "collaborator(s): ");
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
                            if (n % 8 === 7){
                                d.caption += "<br/>";
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
                    d.caption += "' class='fas fa-";
                    d.caption += "briefcase"
                    d.caption += "'></i> my contributions: <br/>";


                    d.caption += "<ul>"
                    d.contribs.forEach(function(contrib, i) {
                        // if (i > 0) d.caption += ",";
                        // if (i === d.contribs.length - 1) d.caption += "</li><li>"
                        d.caption += "<li>"; 
                        // d.caption += " ";

                        if (contrib.type === "development") {
                            d.caption += "<i title='"
                            d.caption += "development";
                            d.caption += "' class='fas fa-";
                            d.caption += "code"
                            d.caption += "'></i> development: ";

                            if (d.code !== undefined && d.code.host === "github") {
                                var url = "https://github.com/" + d.code.account + "/"
                                if (d.code.repo !== undefined) url += d.code.repo;
                                d.caption += " <a href='" + url + "' title='"
                                d.caption += url
                                d.caption += "' class='fab fa-github'>";
                                // d.caption += "<span class='label'>Github</span>"
                                d.caption += "</a>";
                            }
                        } else {
                            d.caption += " <i title='" + contrib.type + "' class='fas fa-";
                            if (contrib.type === "organization") {
                                d.caption += "sitemap"
                                d.caption += "'></i> organization: ";
                            } else if (contrib.type === "design") {
                                d.caption += "lightbulb"
                                d.caption += "'></i> design: ";
                            }
                        }
                        d.caption += " ";
                        //d.caption += "(";
                        d.caption += contrib.desc;
                        //d.caption += ")";
                        d.caption += "</li>";     
                    });
                    d.caption += "</ul>"
                    d.caption += "</li>";
                }
                d.caption += "</ul>"
                return img;
            })
    });
};