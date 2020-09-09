PUBVIS = function () {
    var make_it_all = function (params) {
        filename = params.filename;
        covers = params.covers;
        thumbs = params.thumbs;
        target = params.target;
        selection_color = params.color;

        decoraton_color = params.decoraton_color;

        //inform the user about loading
        //$(target).append("<div id='loading'> LOADING... </div>");

        //access the bibfile, convert and display 
        fetch_bibfile(filename);
    };

    //access the bib.file, start the conversion into a json 
    //and start the representation of the data
    //@param.filename = String (e.g "file.bib")
    var fetch_bibfile = function (filename) {
        var result;

        $.get(filename, function (data) {

            result = bib2json(data);
            //console.log(result);
            result = parseStringYearToCurrentYear(result);
            //console.log(result);
            display_data(result.json, prepare_errors(result.errors).error_text);

        }).fail(function () {
            //$("#loading").hide();
            $("body").append("<div id='error'> Sorry, the BibTex file cannot be found. </br></br>Please check if the the file '" + filename + "' contains a correct URL and/or correct filename.</div>");
        });
    }

    //return oneBigJson and errors in an object
    //@param.bibfile = bib data
    var bib2json = function (bibfile) {
        var dataArr, bigJson, errors, entry, jsonFormat, str;

        dataArr = bibfile.splitKeep(/@[a-zA-Z]+ *{/g, 1);

        bigJson = [];
        errors = { index: [], errorMessage: [], errorEntry: [] };
        for (var i = 0; i <= dataArr.length - 1; i++) {

            entry = dataArr[i].toString();

            try {
                //pars bib-entry to JSON list with one object
                jsonFormat = bibtexParse.toJSON(entry);
            } catch (e) {
                errors.index.push(i);
                errors.errorMessage.push(e);
                errors.errorEntry.push(entry);
                jsonFormat = "";
            }

            if (jsonFormat !== "") {
                //combine lists 
                bigJson = bigJson.concat(jsonFormat);
            }

        };

        //changing all entryTags and entryTypes to lowercase (e.g. Author -> author) otherwise they will not be recognized by the programm
        for (e = 0; e < bigJson.length; e++) {
            var entryTags = bigJson[e].entryTags;
            var newEntryTags = {};
            var keys = Object.keys(entryTags);
            for (i = 0; i < keys.length; i++) {
                var key = keys[i];
                newEntryTags[key.toLowerCase()] = entryTags[key];
            }

            if (newEntryTags['doi'] != undefined && newEntryTags['url'] == undefined) {
                newEntryTags['url'] = 'http://dx.doi.org/' + newEntryTags['doi'];
            }

            bigJson[e].entryTags = newEntryTags;
            bigJson[e].entryType = bigJson[e].entryType.toLowerCase();
        }

        return {
            json: bigJson,
            errors: errors
        };
    }

    //  if the year of an entry is a String (like in press or submitted) the value will be changed to the current year
    var parseStringYearToCurrentYear = function (data) {
        var tmp_json = data.json;
        var tmp_errors = data.errors;
        var currYear = new Date().getFullYear().toString();

        for (i = 0; i < tmp_json.length; i++) {
            var year = tmp_json[i]["entryTags"]["date"];
            if(year !== undefined){
                year = year.split('-')[0];
                year = year.split('/')[0];
            }
            tmp_json[i]["entryTags"]["year"] = year;

            if (isNaN(year)) {
                tmp_json[i]["entryTags"]["year"] = currYear;
            }
        }

        return {
            json: tmp_json,
            errors: tmp_errors
        };
    }

    //draw data
    //@param.json = bib entries in json format
    var display_data = function (json, error_text) {
        //console.dir( json );
        var real_life_data, generated_data, dataset_years, dataset_amount, dataset_types, dataset_types_text;
        var filtered_json;
        var change_color_of_item, get_width_of_text_element, set_data_period;
        var show_header, show_amount, show_btn_clearAll;
        var show_btn_sortByYear, show_btn_sortByType;
        var sort_by_type;
        var sort_by_year;
        var sort_by = 0;
        var chart_years = {}, chart_type = {};
        var keywords = [], wordcloud = {}, list = {}, authors = [];
        var selected_items = { years: [], types: [], keywords: [], authors: [] };
        var add_selected_item, remove_selected_item, item_already_selected;
        var count_key_in_entryTags, get_years, get_types;
        var entryTypes_grouped_text = ["Conference Papers", "Journal Articles", "Reports", "Presentations", "Software", "Artworks", "Students"];
        var entryTypes_width = 100;
        var selected_items_changed = false, last_selected_view, last_selected_item;
        var selected_authors;
        var current_timeline, timeline_changed = false;
        var setup_layout;
        var window_width;
        var width;
        var max_width = 1024;
        var space_left = 0; //space between svg and left side of the browser
        var space_between_view = 5;
        var svg_margin_top = 0;
        var header_height = 20;
        var timeline_height = 100;
        var types_height = 150;
        var types_width = 200;
        var cloud_authors_height = types_height;
        var cloud_authors_width = (window_width - types_width - 2 * space_between_view) / 2;
        var cloud_keywords_height = types_height;
        var cloud_keywords_width = cloud_authors_width;
        var button_width = 75; //clearAll button
        var button_height = 30; //clearAll button
        // global vars for positioning determined by setup_layout()
        var timeline_yPos;
        var types_yPos;
        var cloud_authors_xPos;
        var cloud_authors_yPos;
        var cloud_keywords_xPos;
        var cloud_keywords_yPos;
        var svg_height;
        //
        var empty = [];
        var words_displayed = [], authors_displayed = []; //contain words/authors that are really displayed
        var clearAll_pushed = false;
        var text_color_for_types;
        var svg;
        var highligth_color = selection_color;
        var years_available, types_available, keywords_available, authors_available; //boolean that indicates if this data exists in the bibTeX.file
        var max_number_of_bars = 30;//for desktop. will be adapted in the calculate_width function if the device width is less than 980

        //*************************HELPER FUNCTIONS***********************//

        //function in progress...
        function update_window() {
            //console.log("updateWindow aufgerufen");

            // $( "svg" ).remove();

            window_width = /*window.innerWidth || document.documentElement.clientWidth ||*/ document.getElementById('pubvis_container').clientWidth;
            //y = w.innerHeight|| e.clientHeight|| g.clientHeight;

            //calculation of the position for the views
            calculate_width();

            var window_height = /*window.innerHeight || document.documentElement.clientHeight ||*/ document.getElementById('pubvis_container').clientHeight;
            svg_height = svg_margin_top + header_height + timeline_height + types_height + (space_between_view * 3);
            // var footer_height = parseInt(d3.select("#footer").style("height"), 10);

            //d3.select( "#pubvis_container" ).attr("height",window_height);
            //d3.select( "#pubvis_div" ).attr("height",svg_height);
            //d3.select( "#list" ).attr("height",(window_height-svg_height-footer_height));
            //d3.select( "#s_acc" ).attr("height",(window_height-svg_height-footer_height));

            //d3.select( "#pubVis" ).attr("width",window_width);
            d3.select("#header").attr("width", window_width);
            d3.select("#div_logo").attr("width", window_width);
            d3.select("#clearAll").attr("transform", "translate(" + (window_width - button_width) + ", 0 )");
            d3.select("#sortByYear").attr("transform", "translate(" + (window_width - 2 * button_width) + ", 0 )");
            d3.select("#sortByType").attr("transform", "translate(" + (window_width - 3 * button_width) + ", 0 )");
            d3.select("#timeline").attr("width", window_width);
            d3.select("#background_timeline").attr("width", window_width);

            d3.select("#background_cloud_authors").attr("width", cloud_authors_width);
            d3.select("#authors").attr("width", cloud_authors_width);
            d3.select("#cloud_authors")
                .attr("width", cloud_authors_width)
                .select("#keywords")
                .attr("width", cloud_authors_width)
                .attr("transform", "translate(" + cloud_authors_xPos + "," + cloud_authors_yPos + ")");
            d3.select("#background_cloud_keywords")
                .attr("width", cloud_keywords_width)
                .attr("transform", "translate(" + (cloud_keywords_xPos) + "," + cloud_keywords_yPos + ")");
            d3.select("#cloud_keywords")
                .attr("width", cloud_keywords_width)
                .select("#keywords")
                .attr("width", cloud_keywords_width)
                .attr("transform", "translate(" + cloud_keywords_xPos + "," + cloud_keywords_yPos + ")");

            //d3.select( "#list" ).style( "height",window_height-svg_height-footer_height);
            //d3.select( "#s_acc" ).style( "height",window_height-svg_height-footer_height);

            //build html structure
            //setup_layout();

            //display the view
            //display_all_views();

        }

        window.addEventListener('resize', function (event) {
            update_window();
        });


        //claculates the width and the space left for the maring
        //which will be used in the setup_layout() for the svg and 
        //in the LIST() for the margin of the list
        //change the number of bars in the timeline accoording to the device width 
        var calculate_width = function () {
            //console.log( "calculate aufgerufen" );

            window_width = /*window.innerWidth || document.documentElement.clientWidth ||*/ document.getElementById('pubvis_container').clientWidth;

            /*if ( window_width > max_width){
                space_left = ((window_width - max_width) /2);
                width = max_width;
                window_width -= space_left //subtract the space left (used for margin-left) so the width of the whole screen won't extend 100%
            } else { 
                width = window_width;
                space_left = 0;
            }*/
            width = window_width;

            //according to the width of the screen change the maxinum number of bars for the timeline
            //tablett
            if (window_width <= 980 && window_width >= 760) {
                max_number_of_bars = 15;
                space_left = 0;
                //smartphone
            } else if (window_width < 760) {
                max_number_of_bars = 5;
                space_left = 0;
            }

            cloud_authors_height = types_height;
            cloud_authors_width = (window_width - types_width - 2 * space_between_view) / 2;
            cloud_keywords_height = types_height;
            cloud_keywords_width = cloud_authors_width;

            timeline_yPos = header_height + space_between_view;
            types_yPos = timeline_yPos + timeline_height + space_between_view;
            cloud_authors_xPos = 0;//types_width + space_between_view;
            cloud_authors_yPos = 0;//types_yPos;
            cloud_keywords_xPos = 0;//cloud_authors_xPos + cloud_authors_width + space_between_view;
            cloud_keywords_yPos = 0;//types_yPos;
            cloud_authors_width = (window_width - types_width - 2 * space_between_view) / 2;
            cloud_keywords_width = cloud_authors_width;

            //console.log( "space_left: " + space_left );
            //console.log( "document width: " + $( document ).width() );
            //console.log( "window_width: " + window_width );
        }

        //builds the necessary svg and svg-groups
        setup_layout = function () {
            //console.log( "setup aufgerufen" );
            var header, clearAll;
            var sortByYear, sortByType;
            var timeline;
            var types;
            var cloud_authors;
            var cloud_keywords;
            var list;
            var background_timeline;
            var background_cloud_authors;
            var background_cloud_keywords;
            var background_list;

            //calculation of the position for the views
            timeline_yPos = header_height + space_between_view;
            types_yPos = timeline_yPos + timeline_height + space_between_view;
            cloud_authors_xPos = types_width + space_between_view;
            cloud_authors_yPos = types_yPos;
            cloud_keywords_xPos = cloud_authors_xPos + cloud_authors_width + space_between_view;
            cloud_keywords_yPos = types_yPos;
            svg_height = svg_margin_top + header_height + timeline_height + types_height + (space_between_view * 3);
            //console.log( "svg_height: " + svg_height );

            //create the svg:
            /*svg = d3.select( "#palette" )
                      .append( "svg" )
                      .attr({
                        id: "pubVis",
                        width: window_width, //full size of screen for the svg, otherwise some parts maybe hidden
                        height: svg_height//880
                      })
                      .attr("transform", "translate(0," + svg_margin_top + ")"); 
            
            //center the visualization
            $( "#pubVis" ).css("margin-left", space_left);*/

            //create all groups for the views:
            /*header = d3.select( "#header" )
                                    .append( "g" )
                                    .attr({
                                        id: "header",
                                        width: width,
                                        height: header_height
                                    })
                                    .attr("transform", "translate( 0, 0)")*/

            clearAll = d3.select("#header")
                .append("g")
                .attr({
                    id: "clearAll",
                    width: button_width,
                    height: button_height
                })
            //.attr("transform", "translate(" + (width - button_width) + ", 0 )");

            sortByYear = d3.select("#header")
                .append("g")
                .attr({
                    id: "sortByYear",
                    width: button_width,
                    height: button_height
                })
                .attr("transform", "translate(" + (width - 2 * button_width) + ", 0 )");

            sortByType = d3.select("#header")
                .append("g")
                .attr({
                    id: "sortByType",
                    width: button_width,
                    height: button_height
                })
                .attr("transform", "translate(" + (width - 3 * button_width) + ", 0 )");

            timeline = d3.select("#timeline_container")
                .append("svg")
                .classed("svg-content", true)
                .append("g")
                .attr({
                    id: "timeline",
                    width: width,
                    height: timeline_height //includes space between header and overview
                })
            //.attr("transform", "translate( 0," + timeline_yPos + ")");


            background_timeline = d3.select("#timeline")
                .append("rect")
                .attr({
                    x: 0,
                    y: 0,
                    width: width,
                    height: timeline_height,
                    fill: "#FFFFFF",
                    opacity: 1,
                    id: "background_timeline"
                })
                .attr("transform", "translate( 0, 0)");

            types = d3.select("#types_container")
                .append("svg")
                .classed("svg-content", true)
                .append("g")
                .attr({
                    id: "types",
                    width: (types_width - entryTypes_width),
                    height: types_height //includes space between header and overview
                })
                .attr("transform", "translate( " + entryTypes_width + "," + 0 + ")");


            background_types = d3.select("#types")
                .append("rect")
                .attr({
                    x: 0,
                    y: 0,
                    width: (types_width - entryTypes_width),
                    height: types_height,
                    fill: "#FFFFFF",
                    opacity: 1,
                    id: "background_types"
                })
                .attr("transform", "translate( 0, 0)");

            //text will be shown if no years are in the bib file
            /*d3.select( "#timeline" ).append( "text" )
            .text ( "publication years are not available " )
            .attr({
                    x: 20,
                    y: 20, 
                    fill: "#333333",
                    "text-anchor": "start",
                    "font-weight": "300",
                    opacity: 0,
                    id: "txt_no_years_message"
            })
            .style("font-size", "20");*/

            //text will be shown if no types are in the bib file
            d3.select("#types").append("text")
                .text("publication types are not available ")
                .attr({
                    x: width / 2,
                    y: types_height * 0.75,
                    fill: "#333333",
                    "text-anchor": "start",
                    "font-weight": "300",
                    opacity: 1,
                    id: "txt_no_types_message"
                })
                .style("font-size", "20");



            cloud_authors = d3.select("#authors_container")
                .append("svg")
                .classed("svg-content", true)
                .append("g")
                .attr({
                    id: "cloud_authors",
                    width: cloud_authors_width,
                    height: cloud_authors_height //includes space between overview and cloud
                })
                .attr("transform", "translate( " + 0 + "," + 0 + ")");

            cloud_keywords = d3.select("#keywords_container")
                .append("svg")
                .classed("svg-content", true)
                .append("g")
                .attr({
                    id: "cloud_keywords",
                    width: cloud_keywords_width,
                    height: cloud_keywords_height //includes space between overview and cloud
                })
                .attr("transform", "translate( " + 0 + "," + 0 + ")");

            background_cloud_keywords = d3.select("#cloud_keywords")
                .append("rect")
                .attr({
                    x: 0,
                    y: 0,
                    width: cloud_keywords_width, //15 because of the space between the two clouds
                    height: cloud_keywords_height,
                    fill: "#FFFFFF",
                    opacity: 0,
                    id: "background_cloud_keywords"
                })
            //.attr("transform", "translate(" + (cloud_keywords_xPos) + "," + cloud_keywords_yPos + ")")

            //text will be shown if no keywords are in the bib file
            /*d3.select( "#cloud_keywords" ).append( "text" )
            .text ( "keywords are not available " )
            .attr({
                    x: width-20,//20 for margin right
                    y: 20, 
                    fill: "#333333",//color_text,
                    "text-anchor": "end",
                    "font-weight": "300",
                    opacity: 0,
                    id: "txt_no_words_message"
            })
            .style("font-size", "20");*/


            background_cloud_authors = d3.select("#cloud_authors")
                .append("rect")
                .attr({
                    x: 0,
                    y: 0,
                    width: cloud_authors_width, //15 because of the space between the two clouds
                    height: cloud_authors_height,
                    fill: "#FFFFFF",
                    opacity: 1,
                    id: "background_cloud_authors"
                })
            //.attr("transform", "translate(" + (cloud_authors_xPos) + "," + cloud_authors_yPos + ")");

            //text will be shown if no authors are in the bib file
            d3.select("#cloud_authors").append("text")
                .text("authors are not available ")
                .attr({
                    x: width / 2 - 35, //35 because of 15 between clouds and for 20 margin right
                    y: 20,
                    fill: "#333333",//color_text,
                    "text-anchor": "end",
                    "font-weight": "300",
                    opacity: 0,
                    id: "txt_no_authors_message"
                })
                .style("font-size", "20");
        }

        //show the element of the given id by changing its opacity
        var show_message_for_missing_data = function (id) {
            //console.log( "show_message aufgerufen" );
            var words;

            d3.select(id).attr('opacity', '1');
        }

        //set the display of the element with the given id to the given bool
        //true = element will be shown
        //false = element will be hidden
        var show = function (id, value) {

            document.getElementById(id).style.display = value ? 'block' : 'none';
        }

        //check after the interval is past if the body was loaded.
        //if the body is defined the interval will be cleared and 
        //the onReady function will be executed
        //source: http://stackoverflow.com/questions/25253391/javascript-loading-screen-while-page-loads
        var onReady = function (callback) {
            var intervalID = window.setInterval(checkReady, 1000);

            function checkReady() {
                if (document.getElementsByTagName('body')[0] !== undefined) {
                    window.clearInterval(intervalID);
                    callback.call(this);
                }
            }
        }

        //call all views to display them
        var display_all_views = function () {
            //console.log( " display views" );

            prepare_authors();

            //***display header
            show_header = HEADER(decoraton_color);
            show_btn_clearAll = CLEAR_ALL(decoraton_color);
            show_btn_sortByYear = BUTTON_YEAR(decoraton_color);
            show_btn_sortByType = BUTTON_TYPE(decoraton_color);

            //fetch years from json 
            dataset_years = get_years({ json: json }).time_list;

            //dataset_years = generated_data.years;
            dataset_amount = get_years({ json: json }).amount_list;
            //dataset_amount = generated_data.amount;

            //***display bar-chart with years
            if (dataset_years.length !== 0 && dataset_amount.length !== 0) {
                chart_years = BAR_YEARS.create_bar_years({
                    data_years_all: dataset_years,
                    data_amount_all: dataset_amount,
                    color_bar: "#D9D9D9",
                    color_text: "#000000",
                    color_background_div: decoraton_color,
                    view_height: timeline_height,
                    margin: { top: 0, right: 25, bottom: 0, left: 25 },
                    //view_width: 1024,
                    view_width: width,
                    container: "#timeline"
                });
                chart_years.render();
                years_available = true;
            } else {
                //console.log( "there are no years/amount in the bibfile!");
                show_message_for_missing_data("#txt_no_years_message");
                years_available = false;
            }

            //console.log( "years: " +  years_available );

            //fetch types from json
            dataset_types = get_types(json).type_list;
            dataset_types_text = get_types(json).types_text;

            //***display bar-chart with types
            if (dataset_types.length !== 0 && dataset_types_text.length !== 0) {
                chart_type = BAR_TYPE.create_bar_type({
                    all_entry_types: dataset_types,
                    entry_types_text: dataset_types_text,
                    color_bar: "#D9D9D9",
                    color_text: "#333333",
                    view_height: types_height,
                    margin: { top: 0, right: 0, bottom: 0, left: 0 },
                    //view_width: 1024,
                    view_width: types_width - entryTypes_width,
                    container: "#types"
                });
                chart_type.render();
                types_available = true;
            } else {
                show_message_for_missing_data("#txt_no_types_message");
                types_available = false;
            }
            //console.log( "types: " +  types_available );

            //***display total number of entries and number of selected entries
            show_amount = AMOUNT({
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                color_text: "#333333",
                //text_size: "70px",
                total: json.length,
                selected: "0",
                width: width / 2
            });
            //fetch the keywords
            keywords = get_words(json).words;

            //***if keywords available display them in the tagCloud
            if (keywords.length !== 0) {
                keywords = limit_words({ words: keywords, optimum_size: 80, min: 1 });
                //console.log( "keywords" );
                //console.dir(keywords);
                wordCloud = CLOUD({
                    type: "keywords",
                    words: keywords,
                    xPos: cloud_keywords_xPos,
                    yPos: cloud_keywords_yPos,
                    size: [cloud_keywords_width, cloud_keywords_height]
                });
                keywords_available = true;
            } else {
                //console.log( "there are no keywords in the bibfile!");
                show_message_for_missing_data("#txt_no_words_message");
                keywords_available = false;
            }
            //console.log( "words: " +  keywords_available );


            //fetch the authors 
            authors = get_authors(json).authors;
            //console.log( "authors" );
            //console.dir( authors );



            //***if authors available display them in the tagCloud
            if (authors.length !== 0) {

                authors = limit_words({ words: authors, optimum_size: 80, min: 1 });
                //console.log( "authors.length after limit function: "+ authors.length );

                wordCloud = CLOUD({
                    type: "authors",
                    words: authors,
                    xPos: cloud_authors_xPos,
                    yPos: cloud_authors_yPos,
                    size: [cloud_authors_width, cloud_authors_height]
                });



                authors_available = true;
            } else {
                //console.log( "there are no authors in the bibfile!");
                show_message_for_missing_data("#txt_no_authors_message");
                authors_available = false;
            }
            //console.log( "authors: " +  authors_available );

            //***display list
            list = LIST({ data: json, update: false, button_color: decoraton_color });

            FOOTER();

            //console.log( "authors.length: " + authors.length );
            //console.dir( authors );
            //console.log( "keywords.length: " + keywords.length );
        }

        //adds an additional filter cirteria to the selected_items list
        //@params.years = number ( eg 2011 )
        //@params.types = Stirng ( eg "article" )
        //@params.authors && @params.words planed >> currently not implemented
        add_selected_item = function (params) {
            //console.log( "call: add_selected_item" );
            var value = params.value;
            var key = params.key;

            if (key === "years") {
                selected_items.years.push(value);
                selected_items_changed = true;
                last_selected_item = value;
                last_selected_view = key;
            }

            if (key === "types") {
                selected_items.types.push(value);
                selected_items_changed = true;
                last_selected_item = value;
                last_selected_view = key;
            }

            if (key === "keywords") {
                selected_items.keywords.push(value);
                selected_items_changed = true;
                last_selected_item = value;
                last_selected_view = key;

            }

            if (key === "authors") {
                selected_items.authors.push(value);
                selected_items_changed = true;
                last_selected_item = value;
                last_selected_view = key;

            }

        }

        //search the array and retruns a boolean "true" if the item is contained
        //@params.array = Array
        //@params.key = String (eg "year")
        //@params.value = String (eg "2011")
        item_already_selected = function (params) {
            //console.log( "call: item_already_selected" );
            var array = params.array;
            var key = params.key;
            var value = params.value;
            var list = params.list;
            var item_contained = false;
            //console.log( "key: " + key + " value: " + value + " list: " + list );

            if (key === undefined && list !== undefined) {

                for (var i = 0; i < array[list].length; i++) {

                    if (array[list][i] === value) {
                        item_contained = true;
                    }
                }
            }

            if (list === undefined && key !== undefined) {

                for (var z = 0; z < array.length; z++) {


                    if (array[z][key] === value) {
                        item_contained = true;
                    }
                }
            }

            if (key === undefined && list === undefined) {

                for (var y = 0; y < array.length; y++) {

                    if (array[y].toString() === value) {
                        item_contained = true;
                    }
                }
            }

            //console.log( "item contained?: " + item_contained );
            return item_contained;
        }

        //removes the given value from selected_item.key list
        //@params.value = String (eg. "2011", "article")
        //@params.key = String ( "years" or "types")
        remove_selected_item = function (params) {
            //console.log( "call remove_selected_item" );
            var key = params.key;
            var value = params.value;

            //console.log( "key: " + key + " value: " + value );

            for (var i = 0; i < selected_items[key].length; i++) {

                if (selected_items[key][i] === params.value) {
                    selected_items_changed = true;
                    last_removed_item = params.value;
                    selected_items[key].splice(i, 1);
                    //console.log( "item removed: " + selected_items[key][ i ] );
                    break;
                }
            }
            last_selected_item = value;
        }

        //if the width of an text element is needed before the text element can be drawn (e.g because of the order of svg elements)
        //creates the elements based on the given data, returns the width and height
        //and removes the created element
        //@params.data = array
        //@params.group = the svg-group
        //@params.svg = svg
        get_width_of_text_element = function (params) {
            //console.log( "get_width_of_text_element aufgerufen" );

            var svg = params.svg;
            var group = params.group;
            var data = params.data;
            var element, element_width, element_height;

            element = group.selectAll("text")
                .data(data)
                .enter()
                .append("text")
                .text(function (d) { return d; })
                .attr({
                    x: 0,
                    y: 0,
                    class: "element"
                })

            element.each(function () {
                //element_width = this.getBBox().width;
                //element_height = this.getBBox().height;
            })

            svg.selectAll("text.element").remove();

            return {
                width: element_width,
                height: element_height
            };
        }

        //slices a given dataset into the needed periods that are demanded by the left/right-buttons next to the year labels 
        //@params.incoming_dataset = list 
        //@params.count_clicks = number
        //@params.steps = number indicating how many years will be updated if button "left/right" is clicked
        //@params.max_number_of_bars = number of years to display in the bar chart (e.g 30 produce bars from 1984 - 2014)
        //@params.number_of_periods = number
        set_data_period = function (incoming_dataset, count_clicks, steps, max_number_of_bars, number_of_periods) {
            var new_dataset = {}, index_start, index_ende, end_period, start_period;
            var incoming_dataset, count_clicks, steps, last_step, last_step_difference, max_number_of_bars;

            start_period = max_number_of_bars * (-1) - 1;

            //check if the last period of years are less than the number of regular steps
            //calculate the last step and consequentliy the start_index and end_index to slice the datalist correctly
            if (((incoming_dataset.length - 1) % steps !== 0)
                && (count_clicks > number_of_periods)) {

                last_step = ((incoming_dataset.length - 1) - max_number_of_bars) - (number_of_periods * steps);
                last_step_difference = steps - last_step;

                //index is negative, cause then the new_dataset will begin that many elements from the end of the array
                index_start = start_period - (count_clicks * steps) + last_step_difference;
                index_ende = steps * (count_clicks * -1) + last_step_difference;

            } else {
                index_start = start_period - (count_clicks * steps);
                index_ende = steps * (count_clicks * -1);
            }

            //index is negative, because then the new_dataset will begin that 
            //many elements from the end of the array                
            if (index_ende === 0) {
                new_dataset = incoming_dataset.slice(index_start);
            } else {
                new_dataset = incoming_dataset.slice(index_start, index_ende);
            }

            return new_dataset;
        }

        //returns the amount of the occurence of the given value in the given array  
        //@param.array = array
        //@param.value = string (example "year")
        count_key_in_entryTags = function (array, key) {
            var counter = 0;

            for (var z = 0; z < array.length; z++) {

                if (array[z] === key) {
                    counter++
                }
            }
            return counter;
        }

        //returns a list with counted types in the neended range for displaying as bars
        //@params.array = array (containing multiple entrytypes as strings)
        //range of the returned array: ["Journal Articles", "Book", "Part of a Book", "Conference Papers", "Thesis", "Misc", "Reports"] 
        var group_types = function (params) {
            var array = params.values;
            var array_entries = params.entries;
            var entryTypes_grouped = new Array(entryTypes_grouped_text.length).fill(0);
            var entries_grouped = { articles: [], artworks: [], book: [], part_book: [], conference: [], presentations: [], software: [], thesis: [], report: [], misc: [] }


            for (var y = 0; y < array.length; y++) {

                if (array[y] === "article") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Journal Articles');
                    entryTypes_grouped[i] += 1;
                    entries_grouped['articles'].push(array_entries[y]);
                }

                if (array[y] === "artwork") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Artworks');
                    entryTypes_grouped[i] += 1;
                    entries_grouped['artworks'].push(array_entries[y]);
                }

                if (array[y] === "book") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Book');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.book.push(array_entries[y]);
                }

                if (array[y] === "booklet") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Book');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.book.push(array_entries[y]);
                }

                if (array[y] === "inbook") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Part of a Book');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.part_book.push(array_entries[y]);
                }

                if (array[y] === "incollection") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Part of a Book');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.part_book.push(array_entries[y]);
                }

                if (array[y] === "conference") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Conference Papers');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.conference.push(array_entries[y]);
                }

                if (array[y] === "inproceedings") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Conference Papers');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.conference.push(array_entries[y]);
                }

                if (array[y] === "proceedings") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Conference Papers');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.conference.push(array_entries[y]);
                }

                if (array[y] === "unpublished") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Presentations');
                    entryTypes_grouped[i] += 1;
                    entries_grouped['presentations'].push(array_entries[y]);
                }

                if (array[y] === "software") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Software');
                    entryTypes_grouped[i] += 1;
                    entries_grouped['software'].push(array_entries[y]);
                }

                if (array[y] === "thesis") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Students');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.thesis.push(array_entries[y]);
                }

                if (array[y] === "mastersthesis") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Students');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.thesis.push(array_entries[y]);
                }

                if (array[y] === "phdthesis") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Students');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.thesis.push(array_entries[y]);
                }

                if (array[y] === "misc") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Misc');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.misc.push(array_entries[y]);
                }

                if (array[y] === "manual") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Reports');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.report.push(array_entries[y]);
                }

                if (array[y] === "techreport") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Reports');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.report.push(array_entries[y]);
                }

                if (array[y] === "report") {
                    var i = entryTypes_grouped_text.findIndex(t => t === 'Reports');
                    entryTypes_grouped[i] += 1;
                    entries_grouped.report.push(array_entries[y]);
                }
            }
            //console.log( "entries_grouped:"  )
            //console.dir( entries_grouped );
            return {
                count: entryTypes_grouped,
                entries: entries_grouped
            };
        }


        //search for a specific key in an array (e.g. citationKey, entryType, entryTags)
        //@params.json = list (which contains the wanted key)
        //@params.key = String 
        //@params.value = String (eg "entryType")
        var collect_key_in_json = function (params) {
            var json = [];
            var value = "";
            var result_values = [];
            var result_entries = [];

            json = params.json;
            key = params.key;
            value = params.value;

            for (var i = 0; i < json.length; i++) {

                if (value === "") {

                    if (json[i][key]) {

                        result_values.push(json[i][key]);
                        result_entries.push(json[i]);
                    }
                }

                if (json[i][key] === value) {

                    result_values.push(json[i][key]);
                    result_entries.push(json[i]);
                }
            }

            return {
                values: result_values,
                entries: result_entries
            };
        }

        //fecht all results for a specific key in the entryTags 
        //returns a list with values (eg values[..., 2010, 2012, 2013, ...])
        //and a list with the whole matching entries 
        //@param.json = a list object
        //@param.key = String (e.g "year", "keywords", ...) 
        //@param.value = String ( e.g. "2011", "Data Mining, Data Simplification, KDD, Visual analytics", ... )
        //if key is not defined (key = ""), the result will return all matchs for the key 
        var collect_key_in_entryTags = function (params) {
            //console.log( "collect_key_in_entryTags aufgerufen" );;
            var json = [];
            var value = "";
            var result_values = [];
            var result_entries = [];
            json = params.json;
            key = params.key;
            value = params.value;

            for (var i = 0; i < json.length; i++) {
                if (value === "") {

                    if (json[i]["entryTags"][key]) {

                        result_values.push(json[i]["entryTags"][key]);
                        result_entries.push(json[i]);
                    }
                }

                if (json[i]["entryTags"][key] === value) {

                    result_values.push(json[i]["entryTags"][key]);
                    result_entries.push(json[i]);
                }

            }

            return {
                values: result_values,
                entries: result_entries
            };
        }

        //keyword 'new_id' returns an id without "#"; 
        //keyword 'exist_id': returns an id with "#"
        //@params.group = String (eg keywords, authors) will be part of the id name
        //@params.text = String (eg "Visual Analytics") will be part of the id name, non word characters will be removed
        //@params.element = sort of element ( "text", "div") will be part of the id name
        //exampel for an id that will be returned: txt_keywords_Visual_Analytics
        var generate_words_id = function (params) {
            //console.log( "CALL: generate_words_id" );
            var text = params.text;
            var group = params.group;
            var element = params.element;
            var new_id, exist_id;

            //console.log( "text: " + text + " group: " + group + " element: " + element );

            new_id = "";
            exist_id = "#";
            // console.log( "text: " + text );
            if (text === undefined) return;

            text = text.replace(/ /g, "_");
            text = text.replace(/[^\w\s\-]/gi, ''); //remove all special chars and whitespaces except the -

            if (text.length > 29) {

                short_text = text.substring(0, 29);

            }

            if (element === "text") {
                new_id += "txt_" + group + "_";
                exist_id += "txt_" + group + "_";
            }

            if (element === "div") {
                new_id += "div_" + group + "_";
                exist_id += "div_" + group + "_";
            }

            if (element === undefined) {
                console.log("WARNING: sort of element is not defined!");
            }

            new_id += text;
            exist_id += text;

            //console.log( "new_id: " + new_id ); 
            //console.log( "exist_id: " + exist_id ); 

            return {
                new_id: new_id,
                exist_id: exist_id
            };
        }

        //change color of the given words into the selection_color
        //@params.data = word Array containing at least a "text" element ( data.text ) 
        var highlight_words = function (data) {
            //console.log( "highlight words" );
            var item_value, id_txt_label, id_background_div;
            remove_highlight_selection_items_keywords();

            for (var i = 0; i < data.length; i++) {

                item_value = data[i].text;
                id_txt_label = generate_words_id({ text: item_value, group: "keywords", element: "text" }).exist_id;
                id_background_div = generate_words_id({ text: item_value, group: "keywords", element: "div" }).exist_id;

                if (item_already_selected({ array: words_displayed, key: "id", value: id_txt_label })) {

                    d3.select(id_txt_label).attr('fill', selection_color);

                }
            }
        }

        //change color of the given authors into the selection_color
        //@params.data = word Array containing at least a "text" element ( data.text )
        var highlight_authors = function (data) {
            //console.log( "highlight authors" );
            var item_value, id_txt_label, id_background_div;

            remove_highlight_selection_items_authors();

            for (var i = 0; i < data.length; i++) {

                item_value = data[i].text;
                id_txt_label = generate_words_id({ text: item_value, group: "authors", element: "text" }).exist_id;

                d3.select(id_txt_label).attr('fill', selection_color);
            }
        }

        //update the views of the years-chart, type-chart, wordCloud and according to the given entry list
        //@params.canged_data = a list with etries
        var update_views = function (params) {
            //console.log( "call: update_views" );
            var dataset = params.changed_data;
            var selected_words, selected_authors;

            //update the years chart
            if (years_available) {
                chart_years.highlight_subset(get_years({
                    json: dataset,
                    years_to_display: chart_years.get_current_displayed_years()
                }).amount_list);
                highlight_time_buttons(dataset);
            }


            //update the types chart
            if (types_available) {
                chart_type.highlight_subset(get_types(dataset).type_list);
            }

            //update the number of selected amount
            show_amount.update_selected_amount({ selected_new: dataset.length });

            //check if clear all was hit, consequently the json data have to be displayed by the list
            if ((clearAll_pushed === true)
                || (dataset.length === 0)
                && (selected_items.years.length === 0)
                && (selected_items.types.length === 0)
                && (selected_items.keywords.length === 0)
                && (selected_items.authors.length === 0)) {

                list = LIST({ data: json, update: true, button_color: decoraton_color });
            } else {

                list = LIST({ data: dataset, update: true, button_color: decoraton_color });
            }

            if (keywords_available) {
                //fetch the words for highlighting
                selected_words = get_words(dataset).words;
                //highlight the words
                highlight_words(selected_words);
            }

            if (authors_available) {
                //fetch the authors for highlighting
                selected_authors = get_authors(dataset).authors;
                //highlight the authors
                highlight_authors(selected_authors);
            }
        }

        function highlight_time_buttons(dataset) {
            var years = chart_years.get_current_displayed_years();
            var start_time = years[0];
            var end_time = years[years.length - 1];

            var more_to_left = false;
            var more_to_right = false;

            var selection_details = get_years({ json: dataset });

            for (var i = 0; i < selection_details.amount_list.length; i++) {
                if (selection_details.amount_list[i] && selection_details.time_list[i] < start_time) {
                    more_to_left = true;
                }
                if (selection_details.amount_list[i] && selection_details.time_list[i] > end_time) {
                    more_to_right = true;
                }
            }

            d3.select(".btn_left").style('fill', more_to_left ? selection_color : "rgb(40, 91, 133)");
            d3.select(".btn_right").style('fill', more_to_right ? selection_color : "rgb(40, 91, 133)");
        }

        //change the visibility of the tooltips of the given year 
        //according to the given boolean
        var tooltip_change_visibility = function (hoovered_year, bool) {
            //console.log( "tooltip_change_visibility aufgerufen" );

            var tooltip_id_normal = "#tooltip_normal_" + hoovered_year;
            var tooltip_id_subset = "#tooltip_subset_" + hoovered_year;
            //ids.push( tooltip_id_normal, tooltip_id_subset );

            if (bool === true) {
                d3.select(tooltip_id_normal).attr("opacity", "1");
                d3.select(tooltip_id_subset).attr("opacity", "1");
            } else {
                d3.select(tooltip_id_normal).attr("opacity", "0");
                d3.select(tooltip_id_subset).attr("opacity", "0");
            }
        }

        //creates with the given year ids for the norml and the subset toolbar 
        //returns an array containing both created ids. 
        var get_tooltip_ids = function (year) {
            var ids = [];

            var tooltip_id_normal = "#tooltip_normal_" + year;
            var tooltip_id_subset = "#tooltip_subset_" + year;
            ids.push(tooltip_id_normal, tooltip_id_subset);

            return { ids: ids };
        }

        //clear all highlighted authors
        var remove_highlight_selection_items_authors = function () {
            //console.log( "CALL: remove_highlight_selection_items_authors" );
            var item_value, id_txt_label, id_background_div;

            for (var i = 0; i < authors.length; i++) {

                item_value = authors[i].text;
                //console.log( "text: " + item_value );

                id_txt_label = generate_words_id({ text: item_value, group: "authors", element: "text" }).exist_id;

                d3.select(id_txt_label).attr('fill', "#33333");
                d3.select(id_txt_label).style('font-weight', "300");
            }
        }

        //clear all highlighted keywords
        var remove_highlight_selection_items_keywords = function () {
            //console.log( "CALL: remove_highlight_selection_items_keywords" );
            var item_value, id_txt_label, id_background_div;

            for (var i = 0; i < keywords.length; i++) {

                item_value = keywords[i].text;

                id_txt_label = generate_words_id({ text: item_value, group: "keywords", element: "text" }).exist_id;

                d3.select(id_txt_label).attr('fill', "#33333");
                d3.select(id_txt_label).style('font-weight', "300");

            }
        }

        //clear all highlighted labels in the timeline
        var remove_highlight_selection_items_years = function () {
            //console.log( "CALL: remove_highlight_selection_items_years" );
            var id_txt_label, id_background_div;

            if (years_available) {
                for (var ct = 0; ct < current_timeline.length; ct++) {

                    id_txt_label = "#label_year_" + current_timeline[ct];
                    id_bar = "#bar_subset" + current_timeline[ct];

                    d3.select(id_txt_label).attr('fill', "#000000");
                    d3.select(id_txt_label).style('font-weight', 300);

                    //change the bar
                    //d3.select(id_bar).attr('fill', '#D9D9D9');

                }
            }
        }

        //clear all highlighted labels in the types-chart
        var remove_highlight_selection_items_types = function () {
            //console.log( "CALL: remove_highlight_selection_items_types" );
            var id_txt_label, id_background_div;

            for (var i = 0; i < entryTypes_grouped_text.length; i++) {

                id_txt_label = generate_words_id({ text: entryTypes_grouped_text[i], group: "type", element: "text" }).exist_id;

                //hide div
                //d3.select(id_background_div).attr('opacity', "0");

                d3.select(id_txt_label).style('font-weight', "300");
                d3.select(id_txt_label).attr('fill', text_color_for_types);

            }
        }

        //lookup the selected_itmes list and highlight, 
        //or rather remove the highlight of selected/decelected items
        var highlight_selection_items = function () {
            //console.log( "CALL: highlight_selection_items " );
            var item_value = last_selected_item;
            var item_key;
            var id_txt_label, id_background_div;
            var id_bar;

            //highlight selection items of all year elements
            if ((selected_items.years.length > 0)
                && (selected_items.types.length >= 0)
                && (selected_items.keywords.length >= 0)
                && (selected_items.authors.length >= 0)) {

                item_key = "years";

                remove_highlight_selection_items_years();

                for (var i = 0; i < selected_items.years.length; i++) {

                    item_value = selected_items.years[i];

                    id_txt_label = "#label_year_" + item_value;

                    id_bar = "#bar_subset" + item_value;

                    id_background_div = "#background_div_" + item_value;

                    if (item_already_selected({ array: current_timeline, value: item_value })) {

                        //highlight div
                        //d3.select(id_background_div).attr('stroke', selection_color);
                        //d3.select(id_background_div).attr('stroke-width', "3");
                        //d3.select(id_background_div).attr('fill', selection_color);
                        //d3.select(id_background_div).attr('stroke', "#333333");
                        //d3.select(id_txt_label).attr('fill', "#333333");

                        //change text
                        d3.select(id_txt_label).attr('fill', selection_color);
                        d3.select(id_txt_label).style('font-weight', "900");

                        //change the bar
                        //d3.select(id_bar).attr('fill', selection_color);

                    }
                }
            } else {
                remove_highlight_selection_items_years();
            }

            //highlight selection items of all types elements
            if ((selected_items.types.length > 0)
                && (selected_items.years.length >= 0)
                && (selected_items.keywords.length >= 0)
                && (selected_items.authors.length >= 0)) {

                item_key = "types";

                remove_highlight_selection_items_types();

                for (var x = 0; x < selected_items.types.length; x++) {

                    item_value = selected_items.types[x];

                    id_txt_label = generate_words_id({ text: item_value, group: "type", element: "text" }).exist_id;
                    id_bar = generate_words_id({ text: item_value, group: "type", element: "div" }).exist_id;

                    //console.log( "id_txt_label: " + id_txt_label );

                    //show yellow div 
                    //d3.select(id_background_div).attr('opacity', '1');

                    //change the color and the weight of the clicked items    
                    d3.select(id_txt_label).attr('fill', selection_color);
                    d3.select(id_txt_label).style('font-weight', "900");

                    //change the bar
                    //d3.select(id_bar).attr('fill', selection_color);
                }
            } else {
                remove_highlight_selection_items_types();
            }

            //highlight selection items of all keywords elements
            if ((selected_items.keywords.length > 0)
                && (selected_items.types.length >= 0)
                && (selected_items.years.length >= 0)
                && (selected_items.authors.length >= 0)) {

                item_key = "keywords";

                //remove_highlight_selection_items_keywords();

                for (var k = 0; k < selected_items.keywords.length; k++) {

                    item_value = lookup_wordtext({ array: words_displayed, word_id: selected_items.keywords[k] });

                    id_txt_label = generate_words_id({ text: item_value, group: "keywords", element: "text" }).exist_id;

                    id_background_div = generate_words_id({ text: item_value, group: "keywords", element: "div" }).exist_id;

                    //change the weight of the clicked item
                    d3.select(id_txt_label).style('font-weight', '900');

                    //d3.select(id_txt_label).attr('fill', '#333333');
                    d3.select(id_txt_label).attr('fill', selection_color);
                    //d3.select(id_txt_label).attr('text-decoration', "underline");
                    //d3.select(id_background_div).attr('opacity', '0.5');


                }
            }

            //console.log( "selected_items.authors.length: " + selected_items.authors.length );
            //highlight selection items of all author elements
            if ((selected_items.authors.length > 0)
                && (selected_items.keywords.length >= 0)
                && (selected_items.types.length >= 0)
                && (selected_items.years.length >= 0)) {

                //console.log( "clicked author will be highlighted" );

                item_key = "authors";

                for (var a = 0; a < selected_items.authors.length; a++) {

                    item_value = lookup_wordtext({ array: authors_displayed, word_id: selected_items.authors[a] });

                    var words_id = generate_words_id({ text: item_value, group: "authors", element: "text" });
                    if (words_id !== undefined) {
                        id_txt_label = words_id.exist_id;

                        id_background_div = generate_words_id({ text: item_value, group: "authors", element: "div" }).exist_id;

                        //change the weight of the clicked item
                        d3.select(id_txt_label).style('font-weight', '900');

                        //d3.select(id_txt_label).style('font-weight', '900');
                        //d3.select(id_txt_label).attr('fill', '#333333');
                        d3.select(id_txt_label).attr('fill', selection_color);
                        //d3.select(id_txt_label).attr('text-decoration', "underline");
                        //d3.select(id_background_div).attr('opacity', '0.5');
                    }

                }
            }
        }

        //search for the text of the given id in the words_displayed object
        var lookup_wordtext = function (params) {
            //console.log( "CALL: lookup_wordtext" );
            var text;
            var word_id = params.word_id;
            var arr = params.array;

            //console.log( "lookup word_id: " + word_id )
            //console.dir( arr );

            for (var g = 0; g < arr.length; g++) {

                if (word_id === arr[g].id) {
                    text = arr[g].text;
                }
            }

            return text;
        }
        //lookup_wordtext({ word_id:"#_txt_...", array: words_displayed });

        //filter the text and the id of the given array in a new array
        var save_wordtext_and_wordid = function (params) {
            //var item_text = params.text;  
            //console.log( "CALL: save_wordtext_and_wordid" );
            var item_text, item_id, result = [];

            var id_name = params.id;
            var arr = params.array;

            for (var i = 0; i < arr.length; i++) {

                item_text = arr[i].text;
                item_text = item_text.replace(/[^\w\s\-]/gi, ''); //remove all special chars and whitespaces except the -

                item_id = generate_words_id({ text: item_text, group: id_name, element: "text" }).exist_id;
                result.push({ text: item_text, id: item_id });
            }

            return result;
        }
        //save_wordtext_and_wordid({ array: , id:"" });

        //verify if the given entyType belong to the given type category (Artikle, Book, Part of a Book....) 
        //and returns a boolean if true or false
        //params.type = String (e.g "Book") one of the seven categories
        //params.entryType = String (e.g. "inbook") the type of the target entry
        var is_entry_type_of_catagory = function (params) {
            var type = params.type;
            var entryType = params.entryType;
            var result = false;

            //console.log( "type: " + type + " entryType: " + entryType );
            if (entryType !== undefined) {

                if (type === "Journal Articles") {

                    if (entryType === "article") {

                        result = true;
                    }
                }

                else if (type === "Artworks") {

                    if (entryType === "artwork") {

                        result = true;
                    }
                }

                else if (type === "Book") {

                    if ((entryType === "book")
                        || (entryType === "booklet")) {

                        result = true;
                    }
                }

                else if (type === "Part of a Book") {

                    if ((entryType === "inbook")
                        || (entryType === "incollection")) {

                        result = true;
                    }
                }

                else if (type === "Conference Papers") {

                    if ((entryType === "conference")
                        || (entryType === "proceedings")
                        || (entryType === "inproceedings")) {

                        result = true;
                    }
                }

                else if (type === "Students") {

                    if ((entryType === "thesis")
                        || (entryType === "mastersthesis")
                        || (entryType === "phdthesis")) {

                        result = true;
                    }
                }

                else if (type === "Misc") {

                    if ((entryType === "misc")) {

                        result = true;
                    }
                }

                else if (type === "Presentations") {

                    if ((entryType === "unpublished")) {

                        result = true;
                    }
                }

                else if (type === "Reports") {

                    if ((entryType === "manual")
                        || (entryType === "techreport")
                        || (entryType === "report")) {

                        result = true;

                    }
                }

                else if (type === "Software") {

                    if ((entryType === "software")) {

                        result = true;

                    }
                }

                else {
                    console.log("Warning: no guilty type category was given!");
                    result = false;
                }
            }

            //console.log( "result: " + result );
            return result;
        }

        //*************************SEARCH JSON******************************//


        //returns an object with a list with all years (key: time_list)
        //and a list with the total amounts of publications per year (key: amount_list)
        //@params.json = list with entries
        //@params.years_to_display = array containing all years as Strings that have to be displayed
        var get_years = function (params) {
            //console.log( "get_years aufgerufen" );
            var all_years_double = [];
            var amount_per_years = [];
            var all_years_entries = [];
            var oldest_year;
            var actual_year, time_span;
            var json = params.json;
            var all_years_distinct = params.years_to_display;
            var amount;

            //fetch all years from json as values
            all_years_double = collect_key_in_entryTags({ json: json, key: "year", value: "" }).values;
            //fetch all years from json as entries
            all_years_entries = collect_key_in_entryTags({ json: json, key: "year", value: "" }).entries;

            //sort array (as JS sorts all emlements as strings, this inner function is 
            //necessary to order intagers correct 
            //source: Douglas Crockford, JavaScript. The good Parts., p.80
            all_years_double.sort(function (a, b) {
                return a - b;
            });

            if (all_years_distinct === undefined) {
                //get first element (= oldest year) and calculate time span for length of array           
                all_years_distinct = [];
                //                    actual_year = new Date().getFullYear();
                actual_year = parseInt(all_years_double[all_years_double.length - 1], 10);
                oldest_year = parseInt(all_years_double[0], 10);
                time_span = actual_year - oldest_year;

                //create a new list with time span
                for (var y = 0; y <= time_span; y++) {
                    all_years_distinct.push(oldest_year);
                    oldest_year++;
                }
            } else {
                time_span = all_years_distinct.length - 1;
            }

            //iterate list with all_years_double and count their orccurance
            for (var y = 0; y <= time_span; y++) {

                amount = count_key_in_entryTags(all_years_double, all_years_distinct[y].toString());
                amount_per_years.push(amount);
            }

            return {
                time_list: all_years_distinct,
                amount_list: amount_per_years,
                entries_list: all_years_entries
            };
        }

        //returns an object with: 
        //a list with the total numbers of types, already grouped (key: type_list)
        //a list with all the entries grouped (key: types_entries)
        //a list which contains the groups as Strings (key: types_text)
        var get_types = function (json) {
            //console.log ( "get_types aufgerufen" );
            var all_entry_types = [];
            var entryTypes_grouped_data = new Array(entryTypes_grouped_text.length).fill(0);

            //fetch all types from the json into a list
            all_entry_types = collect_key_in_json({ json: json, key: "entryType", value: "" });

            //count and group the types
            entryTypes_grouped = group_types({ values: all_entry_types.values, entries: all_entry_types.entries });
            entryTypes_grouped_count = entryTypes_grouped.count;
            entryTypes_grouped_entries = entryTypes_grouped.entries;

            return {
                type_list: entryTypes_grouped_count,
                types_entries: entryTypes_grouped_entries,
                types_text: entryTypes_grouped_text
            };
        }


        var filter_by_year = function (item, filter_criteria) {
            if (filter_criteria.years.length === 0) {
                return true;
            }

            for (var y = 0; y < filter_criteria.years.length; y++) {
                if (item.entryTags.year === filter_criteria.years[y]) {
                    return true;
                }
            }
            return false;
        }


        var filter_by_keyword = function (item, filter_criteria) {
            var searched_word, str;

            if (filter_criteria.keywords.length === 0) {
                return true;
            }

            for (var k = 0; k < filter_criteria.keywords.length; k++) {

                searched_word = lookup_wordtext({ array: words_displayed, word_id: filter_criteria.keywords[k] });

                if (item.entryTags.keywords !== undefined
                    && item_already_selected({ array: words_displayed, key: "text", value: searched_word })) {

                    str = item.entryTags.keywords;
                    str = str.replace(/[^\w\s\-]/gi, ''); // remove special chars/whitespaces, except . and -
                    str = str.toLowerCase();
                    searched_word = searched_word.toLowerCase();
                    if (str.search(searched_word) !== (-1)) { return true; };
                }
            }
            return false;
        }


        var filter_by_authors = function (item, filter_criteria) {
            var searched_word, str, pattern;

            if (filter_criteria.authors.length == 0) {
                return true;
            }

            for (var m = 0; m < filter_criteria.authors.length; m++) {

                searched_word = lookup_wordtext({ array: authors_displayed, word_id: filter_criteria.authors[m] });

                if (item.entryTags.author !== undefined
                    && item_already_selected({ array: authors_displayed, key: "text", value: searched_word })) {

                    str = item.entryTags.author;
                    str = str.replace(/[^\w\s\-]/gi, ''); // remove special chars/whitespaces, except . and -

                    pattern = new RegExp("\\b" + searched_word + "\\b", 'i');// '\b' boundaries, so that whole words will match, and no words that only contain this pattern

                    if (str.search(pattern) !== (-1)) {
                        return true;
                    }
                }
            }

            return false;
        }


        var filter_by_type = function (item, filter_criteria) {

            if (filter_criteria.types.length === 0) {
                return true;
            }

            for (var z = 0; z < filter_criteria.types.length; z++) {
                if (is_entry_type_of_catagory({ type: filter_criteria.types[z], entryType: item.entryType })) {
                    return true;
                }
            }
            return false;
        }

        // Iterate over the list of entries, and return those meeting filtering criteria
        //@params.filter_criteria = Object with a list "years" and a list "types" (eg the "selected_items" list)
        var create_filtered_json = function (params) {

            var result = [];
            var filter_criteria = params.filter_criteria;

            for (var i = 0; i < json.length; i++) {

                var item = json[i];

                if (filter_by_year(item, filter_criteria) && filter_by_authors(item, filter_criteria)
                    && filter_by_keyword(item, filter_criteria) && filter_by_type(item, filter_criteria)
                    && !item_already_selected({ array: result, key: "citationKey", value: item.citationKey })) {

                    result.push(item);
                }
            }

            return { entries: result };
        }

        //function that capitalize fist letters of each word in the given string
        //returns string
        //source: http://stackoverflow.com/questions/4878756/javascript-how-to-capitalize-first-letter-of-each-word-like-a-2-word-city
        var to_title_case = function (str) {
            //console.log( "to_title_case: str: " + str );
            return str.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
            );
        }

        //fetch all keywords of the given object and count their occuance 
        //returns a new object with elements. Each element has 
        //a text (no longer than 30 characters)
        //a size (occurence) and 
        //a long_size (the whole text) property.
        var get_words = function (json) {
            //console.log( "get_words aufgerufen" );
            var all_words = [];
            var all_words_str;
            var all_words_single;
            var all_words_single_upperCase = [];
            //var all_words_trimed = [];
            var result = [];
            //var item;
            var count = 1;
            var current, next;
            var short_text, long_text
            var word;

            //fetch all words from json
            all_words = collect_key_in_entryTags({ json: json, key: "keywords", value: "" }).values;

            all_words_str = all_words.toString();

            //replace _ with whitespace
            all_words_str = all_words_str.replace(/_/g, " ");

            //split string at every whitspace
            all_words_single = all_words_str.split(",");

            for (var y = 0; y < all_words_single.length; y++) {
                //change all words to start with upper case and trim them
                word = to_title_case($.trim(all_words_single[y]));
                word = word.replace(/[^\w\s\-]/gi, ''); //remove all special chars and whitespaces except the  -
                all_words_single_upperCase.push(word);
            }

            //sort the array ignoring upper and lower case
            all_words_single_upperCase.sort(
                function (a, b) {
                    var a_lowerCase = a.toLowerCase();
                    var b_lowerCase = b.toLowerCase();

                    if (a_lowerCase < b_lowerCase) return -1;
                    if (a_lowerCase > b_lowerCase) return 1;

                    return 0;
                }
            );

            //compare words and count their occurance
            for (var i = 0; i < all_words_single_upperCase.length; i++) {
                //all words have to start with upper case 
                current = all_words_single_upperCase[i];
                long_text = all_words_single_upperCase[i];

                if (i < all_words_single_upperCase.length - 1) {

                    next = all_words_single_upperCase[(i + 1)];
                } else {
                    next = "";
                }


                if (current === next) {

                    count += 1;
                }
                else {

                    if (current.length > 30) {

                        short_text = current.substring(0, 30) + "...";
                        long_text = current;
                        current = short_text;

                    }

                    result.push({ text: current, size: count, long_text: long_text });
                    count = 1;
                }

            }
            //console.log( "get_words result.length: " + result.length );
            //console.dir( result );  
            return { words: result };
        }

        //reduce the length of the given object
        //lookup the size of the element at the given optimum length. Count up till the size change
        //if the size changes before the absolut max value is reached the object will be cut
        //if the maximum size is exceeded and the size of the ojects hasn't changed the function will
        //go back to the optimum object and count down till the size of the object changes and then cut
        //@params.words = json
        //@params.optimum_size = number
        //@params.min = absolut minimum
        var limit_words = function (params) {
            var words = params.words;
            var optimum_length = params.optimum_size;
            var min = params.min;
            var absolut_max = 40;
            var optimum_size;
            var new_length;
            //var number_to_remove;

            //sort the array descend according to the size of the elements
            words.sort(function (a, b) {
                //console.log( "a[1]: " + a[1] ); 
                return b.size - a.size;
            });


            //check if the length of the given array exceeds the given optimum size
            if (words.length > optimum_length) {
                optimum_size = words[optimum_length].size;

                //look downward if to the element where the size get smaller
                for (var i = optimum_length; i >= 0; i--) {

                    if (optimum_size < words[i].size) {
                        //console.log( "optimum_size: " + optimum_size + " words[i].size: " + words[i].size);
                        //remember the new length
                        new_length = i;

                        //check if the new length is not lower than the given minimum length
                        if (new_length < min) {
                            //console.log( "new length lower than given minimum" );

                            for (var i = optimum_length; i < words.length; i++) {

                                //check at which element the size grows
                                if (optimum_size > words[i].size) {

                                    //take care the size don't get bigger than the absolut maximum size
                                    if (i < absolut_max) {

                                        //console.log( "size of element smaller, new length: " + i );
                                        new_length = i;
                                        words.length = new_length + 1;
                                        break;
                                    }
                                }
                            }
                        } else {
                            //change the length of the words object to the new length
                            words.length = new_length + 1;
                            break;
                        }
                    }
                }
            }

            //console.log( "words from limit function:" );
            //console.dir( words );
            return words;
        }

        //fetch all authors of the given object and count their occuance 
        //returns a new object with elements. Each element has 
        //a text ( last name of author )
        //a size (occurence) and 
        //a first_name ( first name of the author ) property.
        var get_authors = function (json) {
            //console.log( "CALL: get_authors" );
            var all_authors;
            var all_authors_str;
            var all_authors_split;
            var all_authors_split_str;
            var all_authors_single;
            var str;
            var result = [];//{ text:[], size:[], first_name:[] };
            var first_name, last_name;
            var next, current;
            var count = 1;
            var final_result = [];

            //fetch all words from json
            all_authors = collect_key_in_entryTags({ json: json, key: "author", value: "" }).values;
            all_authors_str = all_authors.toString();

            all_authors_split = all_authors_str.split(" and ");
            all_authors_split_str = all_authors_split.toString();

            //split at comma only if there is no whitespace before or after the comma
            all_authors_single = all_authors_split_str.split(/,(?!\s)/);

            for (var i = 0; i < all_authors_single.length; i++) {

                str = all_authors_single[i].trim();

                if (str.search(",") === (-1)) {
                    // no comma found, so split on final space

                    first_name = $.trim(str.substr(0, str.lastIndexOf(' ')));
                    last_name = $.trim(str.substr(str.lastIndexOf(' ')));
                    result.push({ text: last_name, first_name: first_name });

                } else {
                    // comma found, so split on it
                    last_name = $.trim(str.substr(0, str.indexOf(',')));

                    first_name = str.substr(str.indexOf(','));
                    first_name = first_name.replace(/,/g, "");
                    first_name = $.trim(first_name);

                    result.push({ text: last_name, first_name: first_name });
                }
            }

            //sort the array by the last name
            result.sort(function (a, b) {
                if (a.text < b.text)
                    return -1;
                if (a.text > b.text)
                    return 1;
                return 0;
            })

            //console.dir( result );

            //comapre words and count their occurance
            for (var x = 0; x < result.length; x++) {
                //all words have to start with upper case 
                //current = to_title_case( all_words_single[i] );
                current = result[x].text;

                if (x < result.length - 1) {
                    //next = to_title_case( all_words_single[( i + 1 )] );
                    next = result[(x + 1)].text;
                } else {
                    next = "";
                }
                //console.log( "current: " + current + " next: " + next + " count: "+ count);

                if (current === next) {

                    count += 1;
                    //console.log( "current: " + current + " next: " + next + " count: "+ count); 

                } else {

                    //console.log( "PUSH: current: " + current + " count: "+ count);
                    //result.push( {text: current, size: count, long_text: long_text} );
                    //result[x].size.push({size:count});
                    result[x].size = count;
                    final_result.push({ text: result[x].text, size: count, first_name: result[x].first_name });
                    //console.dir( result );
                    count = 1;
                }
            }

            //sort the array by the size
            final_result.sort(function (a, b) {
                //console.log( "a[1]: " + a[1] ); 
                return b.size - a.size;
            });
            //console.dir( final_result );
            return { authors: final_result };
        }

        //prepare auhtors into the needed format to show them in the list-view
        //fetch all authors, removes all commas and replace the 'and' with a comma 
        //append this spelling as new tag called "list_authors" to the json 
        var prepare_authors = function () {
            var names = [];
            var authors_nodes = [];
            var index_number = 0;
            var first_name = "";
            var laste_name = "";
            var match = false;
            var existing_index_nb;
            var authors_edges = [];
            var link_node_data = { nodes: [], edges: [] };

            var update_authors_edges = function (params) {
                //console.log( 'update_authors_edges' );
                var source = params.source;
                var target = params.target;
                var filtered = [];
                //var link_node_data = { nodes: [], edges: [] };


                filtered = authors_edges.filter(function (x) {

                    if ((x.source === source) && (x.target === target)) {
                        //console.log( "match: " + source + " " + target + " " + x.weight );
                        x.weight += 1;
                        //console.log( "changes: " + source + " " + target + " " + x.weight );
                        return true;
                    }

                    return false;
                })
                //if no doubles are found filtered list is falsi
                if (!filtered.length) { //falsi
                    authors_edges.push({ source: source, target: target, weight: 1 });
                    //console.log( "not contained: " + source + " " + target );
                } else { //filtered list contains the doubles
                    //console.log( "contained! " + filtered.length );
                }
            }


            var find_authors_edges = function (params) {
                var list = params.list;
                //console.log( 'find_authors_edges' );
                var source, target;

                for (var i = 0; i < list.length; i++) {
                    for (var y = (i + 1); y < list.length; y++) {

                        //console.log( "source: " + list[i].index + " target: " + list[y].index );
                        source = list[i].index;
                        target = list[y].index;
                        //authors_edges.push({ source:source, target:target }); 
                        update_authors_edges({
                            source: Math.min(source, target),
                            target: Math.max(source, target)
                        });

                    }

                }
            }

            //fetch all authors and remove all comma and replace 'and' with a comma for the list view
            //fetch all authors find out first and last name. Attache them as own element to the bigJson
            for (var i = 0; i < json.length; i++) {

                if (json[i].entryTags.author !== undefined) {


                    //***prepare a string to add an element to the json to display all authors in the list
                    str = json[i].entryTags.author;

                    //all_authors_str = all_authors.toString();
                    str = str.replace(/,/g, "");

                    //split string at every 'and'
                    str = str.replace(/ and /g, ", ");

                    json[i].list_authors = str;


                    /* PREPAREATION OF DATA ONLY IF A NODE-LINK DIAGRAM WOULD HAVE BEEN USED
                       A NODE-LINKE DIAGRAM WILL BE RELEASED ONCE A GOOD SOLUTION OF THE HAIRBALL PROBLEM WILL BE FOUND 
                            //***prepare an array to be attached to the json with the first and last name of the authors
                            //split string at every whitspace
                            authors = json[i].entryTags.author.split( " and " );
    
                            authors_str = authors.toString();
                            //console.log("authors_str: " + authors_str);
    
                            //split at comma only if there is no whitespace before or after the comma
                            authors = authors_str.split( /,(?!\s)/ );
                            //console.log( "authors splitted: " );
                            //console.dir( authors );
                            
                            if ( authors.length !== undefined ) { 
                                //iterate the authors of an entry
                                //according to the position of the comma, find first name, last name and 
                                //then create an index
                                for ( var y = 0; y < authors.length; y++ ){ 
                                    
                                    str = authors[y];
                                    n = str.search( "," ); //n = -1 if there is no comma
    
                                    if ( n === (-1) ) { //no comma found
    
                                        first_name = $.trim( str.substr( 0, str.indexOf(' ') ) );
                                        last_name = $.trim(str.substr( str.indexOf(' ') ) );
    
                                    } else { //comma found
    
                                        last_name = $.trim(str.substr( 0, str.indexOf(',') ) );
                                        first_name = str.substr( str.indexOf(',') );
                                        first_name = first_name.replace (/,/g, "");
                                        first_name = $.trim( first_name );
    
                                    }
    
                                    //look up the previous entries if this author has already an index number 
                                    for ( var x = 0; x < i; x++ ){
    
                                        if ( json[x].authors !== undefined ) { 
    
                                            //look up the list of authors in an entry
                                            for ( var z = 0; z < json[x].authors.length; z++ ) {
    
                                                //if the author has alredy got an index take the existing one
                                                if (   json[x].authors[z].name === last_name
                                                    && json[x].authors[z].first_name === first_name  ){
                                                    
                                                    match = true;
                                                    existing_index_nb = json[x].authors[z].index;
                                                    break;
    
                                                }                                         
                                            }
    
                                        } 
    
                                        if ( match ){
                                            break;
                                        }
                                    }
                                    //if the author has not be found prepare a new index and save the name and the index
                                    if ( match === false ){
    
                                        names.push( {name: last_name, first_name: first_name, index: index_number} );
                                        index_number++;
                                        authors_nodes.push({ name: last_name });
                                    } else {
                                        //if the autor was found save the name, the existing index and increase & save the weight
                                        //console.log( "match true for: " + first_name + " " + last_name);
                                        names.push( {name: last_name, first_name: first_name, index: existing_index_nb} );
    
                                    }
                                    match = false;   
                                }//end for y
    
                                //add the list with names and index to the entry
                                json[i].authors = names;
                                find_authors_edges({ list:names });
                                
                                authors = [];
                                names = [];
    
                            } // if
                    */

                } //if
            } //for i


            link_node_data = { nodes: authors_nodes, edges: authors_edges };
            //console.dir( link_node_data );
            //var string = JSON.stringify(link_node_data);
            //console.log( string );
        }

        //***************************TEST DATA******************************//
        //generates an array with testdata, returns a list with all years counted 
        //from startYear and a list in the same length with randmom amount
        //@params.startYear = number (e.g. 1980)
        var generate_testData = function (startYear) {
            var testArr_years = [], testArr_amount = [], year, amount;
            year = startYear;

            for (var i = startYear; i <= 2014; i++) {
                amount = Math.floor((Math.random() * 40) + 1); //random # between 1 and 10
                testArr_amount.push(amount);
                testArr_years.push(year);
                year++;

            }
            return {
                years: testArr_years,
                amount: testArr_amount
            };
        }

        //*** datasets
        //real_life_data = get_years( {json: json} );
        //generated_data = generate_testData( 1959 );

        //dataset_years = real_life_data.time_list;
        //dataset_years = generated_data.years;
        //dataset_amount = real_life_data.amount_list;
        //dataset_amount = generated_data.amount;

        //var real_life_data_types = get_types( json );
        //dataset_types = real_life_data_types.type_list;
        //dataset_types_text = real_life_data_types.types_text;
        //var testdata = generate_testData( 2008 );
        //dataset_types = testdata.amount;

        //****************************HEADER******************************//
        var HEADER = function (color) {
            var point_1 = "", point_2 = "", point_3 = "";
            var logo_div_width = (width - button_width - 11);
            var home_link = "http://frisson.re";
            var publications_link = "http://frisson.re/PubViz";
            var pubviz_link = "http://pubviz.fhstp.ac.at/";

            //if no color is defined, take a default
            var background_color = (color === undefined || color === "") ? "#333333" : color;

            /*var logo = d3.select( "#header" )
                            .append("g")
                            .attr( "id", "logo_div" )


            var logo_div = logo.append( "rect" )
                                .attr({
                                        x: 0, 
                                        y: 0, 
                                        width: logo_div_width,//(width - button_width - 11),//509,
                                        height: 30,
                                        fill: background_color,
                                        id: "div_logo"
                                })

            var txt_logo = d3.select( "#header" )
                            .append("g")
                            .attr( "id", "txt_logo" ) 
                            


            var text_bold = txt_logo.append("a")
                                .attr("xlink:href", home_link)
                                .attr("target", "_blank")
                                .append( "text" )
                                .text( "Christian Frisson" )
                                .attr({
                                        x: 1, 
                                        y: 23, 
                                        id: "text_bold",
                                        fill: "#000000",
                                        "text-anchor": "start",
                                        "font-weight": "bold"

                                })
                                .style("font-size", "22px")


            var text_regular = txt_logo.append("a")
                                .attr("xlink:href", publications_link)
                                .attr("target", "_blank")
                                .append( "text" )
                                .text( "'s Publications: " )
                                .attr({
                                        x: 165, 
                                        y: 23, 
                                        id: "text_regular",
                                        fill: "#000000",
                                        "text-anchor": "start",
                                        "font-weight": "lighter"

                                })
                                .style("font-size", "22px")


            txt_logo.on( "mouseover", function() {
                        //console.log( "mouseover About" );
                        d3.select("#text_regular").style("text-decoration", "underline");
                        d3.select("#text_bold").style("text-decoration", "underline");
                        d3.select(this).style("cursor", "pointer");
                    })
                    .on( "mouseout", function() {
                        //console.log( "mouseover out About" );
                        d3.select("#text_regular").style("text-decoration", "none");
                        d3.select("#text_bold").style("text-decoration", "none");
                    })
                    .append("title") //show text on hover
                    .text( "go to Christian Frisson's website" )*/

            //show warn-triangle only if error occured
            if (error_text !== "") {

                point_1 = logo_div_width - 110;
                point_2 = point_1 + 7;
                point_3 = point_2 + 7;


                var warining = d3.select("#header")
                    .append("g")
                    .attr("id", "warning_sign")


                var polygon = warining.append("polygon")
                    .attr({
                        points: point_1 + ",22 " + " " + point_2 + ",9 " + " " + point_3 + ",22 ",
                        fill: "#ffc200"//selection_color,
                    })




                var call_sign = warining.append("text")
                    .text("!")
                    .attr({
                        x: point_2,
                        y: 21,
                        fill: "#333333",
                        id: "call_sign",
                        "text-anchor": "middle",
                        "font-weight": "600"

                    })
                    .style("font-size", "12px")


                warining.on("click", function () {
                    //console.log( "clicked!" );

                    if ($("#error_text").length > 0) {
                        show('error_text', true);
                    } else {

                        $(target).append("<div id='error_text'> " + error_text + " </div>");
                        $('#error_text').append('<input id="btn_cancel" type="button" value="Quit"/>');
                        $('#btn_cancel').on('click', function () { show('error_text', false); })
                    }

                })
                    .on("mouseover", function () {
                        d3.select(this).style("cursor", "pointer");
                    })
                    .append("title") //show text on hover
                    .text("Warning: data errors. Click for more info")
            }
        }

        //***************************CLEAR ALL******************************//

        var CLEAR_ALL = function (color) {
            var btn_clearAll;
            var clearAll;
            var btn_text

            //if no color is defined, take a default
            var background_color = (color === undefined || color === "") ? "#333333" : color;

            btn_clearAll = d3.select("#btn_clearAll")
            // btn_clearAll = d3.select("#clearAll")
            //     .append("g")
            //     .attr("id", "btn_clearAll")
                .on("click", function (d, i) {

                    clearAll_pushed = true;
                    sort_by = 0;
                    sort_by_type = false;
                    sort_by_year = false;
                    selected_items = { years: [], types: [], keywords: [], authors: [] };
                    update_views({ changed_data: empty });
                    remove_highlight_selection_items_years();
                    remove_highlight_selection_items_types();
                    remove_highlight_selection_items_keywords();
                    remove_highlight_selection_items_authors();

                }).on("mouseover", function () {
                    d3.select("#btn_clearAll_line").attr("stroke", selection_color);
                    d3.select(this).style("cursor", "pointer");

                }).on("mouseout", function () {
                    d3.select("#btn_clearAll_line").attr("stroke", "#eeeeee");

                }).on("mousedown", function () {
                    d3.select("#txt_clearAll").attr("fill", selection_color);
                }).on("mouseup", function () {
                    d3.select("#txt_clearAll").attr("fill", "#000000");
                });



            // clearAll = btn_clearAll.append("rect")
            //     .attr({
            //         x: 0,
            //         y: 0,
            //         width: button_width,
            //         height: button_height,
            //         fill: background_color,
            //         id: "clearAll_div"
            //     });

            // var lines = btn_clearAll.append("line")
            //     .attr({
            //         x1: 0,
            //         y1: 0,
            //         x2: 0,
            //         y2: button_height,
            //         id: "btn_clearAll_line",
            //         "shape-rendering": "crispEdges",
            //         "stroke": "#eeeeee",
            //         "stroke-width": "5"
            //     });


            // btn_text = btn_clearAll.append("text")
            //     .text("Clear All")
            //     .attr({
            //         x: 20,
            //         y: 20,
            //         id: "txt_clearAll",
            //         fill: "#000000",
            //         "text-anchor": "start",
            //         "font-weight": "lighter"

            //     });

        }

        //***************************BUTTON YEAR******************************//

        var BUTTON_YEAR = function (color) {
            var btn_year;
            var sortByYear;
            var btn_text

            //if no color is defined, take a default
            var background_color = (color === undefined || color === "") ? "#333333" : color;

            btn_year = d3.select("#btn_year")
            // btn_year = d3.select("#sortByYear")
            //     .append("g")
            //     .attr("id", "btn_year")
                .attr("class", "btn")
                /*.on("click", function( d, i ) {
                    sortByYear_pushed = true;
                    if(sort_by_year) {
                        sort_by_year = false;
                        generate(0);
                    } else {
                        sort_by_year = true;
                        sort_by_type = false;
                        generate(1);
                    }
                })*/
                .on("mouseover", function () {
                    d3.select("#btn_sortByYear_line").attr("stroke", selection_color);
                    d3.select(this).style("cursor", "pointer");

                }).on("mouseout", function () {
                    d3.select("#btn_sortByYear_line").attr("stroke", "#eeeeee");

                }).on("mousedown", function () {
                    d3.select("#txt_sortByYear").attr("fill", selection_color);
                }).on("mouseup", function () {
                    d3.select("#txt_sortByYear").attr("fill", "#000000");
                });

            // sortByYear = btn_year.append("rect")
            //     .attr({
            //         x: 0,
            //         y: 0,
            //         width: button_width,
            //         height: button_height,
            //         fill: background_color,
            //         id: "sortByYear_div"
            //     });

            // var lines = btn_year.append("line")
            //     .attr({
            //         x1: 0,
            //         y1: 0,
            //         x2: 0,
            //         y2: button_height,
            //         id: "btn_sortByYear_line",
            //         "shape-rendering": "crispEdges",
            //         "stroke": "#eeeeee",
            //         "stroke-width": "5"
            //     });


            // btn_text = btn_year.append("text")
            //     .text("Year")
            //     .attr({
            //         x: 20,
            //         y: 20,
            //         id: "txt_sortByYear",
            //         fill: "#000000",
            //         "text-anchor": "start",
            //         "font-weight": "lighter"

            //     });

        }

        //***************************BUTTON TYPE******************************//

        var BUTTON_TYPE = function (color) {
            var btn_type;
            var sortByType;
            var btn_text

            //if no color is defined, take a default
            var background_color = (color === undefined || color === "") ? "#333333" : color;

            btn_type = d3.select("#btn_type")
            // btn_type = d3.select("#sortByType")
            //     .append("g")
            //     .attr("id", "btn_type")
                .attr("class", "btn")
                /*.on("click", function( d, i ) {
                    sortByType_pushed = true;
                    if(sort_by_type) {
                        sort_by_type = false;
                        generate(0);
                    } else {
                        sort_by_type = true;
                        sort_by_year = false;
                        generate(2);
                    //}
                })*/
                .on("mouseover", function () {
                    d3.select("#btn_sortByType_line").attr("stroke", selection_color);
                    d3.select(this).style("cursor", "pointer");

                }).on("mouseout", function () {
                    d3.select("#btn_sortByType_line").attr("stroke", "#eeeeee");

                }).on("mousedown", function () {
                    d3.select("#txt_sortByType").attr("fill", selection_color);
                }).on("mouseup", function () {
                    d3.select("#txt_sortByType").attr("fill", "#000000");
                });

            // sortByType = btn_type.append("rect")
            //     .attr({
            //         x: 0,
            //         y: 0,
            //         width: button_width,
            //         height: button_height,
            //         fill: background_color,
            //         id: "sortByType_div"
            //     });

            // var lines = btn_type.append("line")
            //     .attr({
            //         x1: 0,
            //         y1: 0,
            //         x2: 0,
            //         y2: button_height,
            //         id: "btn_sortByType_line",
            //         "shape-rendering": "crispEdges",
            //         "stroke": "#eeeeee",
            //         "stroke-width": "5"
            //     });


            // btn_text = btn_type.append("text")
            //     .text("Type")
            //     .attr({
            //         x: 20,
            //         y: 20,
            //         id: "txt_sortByType",
            //         fill: "#000000",
            //         "text-anchor": "start",
            //         "font-weight": "lighter"

            //     });

        }

        //**************************************************************//
        var CHART = function () {
            //@param.view_height = number, gives the height of the availabel space; margins will be subtracted
            //@param.list_of_margins = eg. margin = {top: 20, right: 30, bottom: 20, left: 10}
            var create_bar_chart = function (params) {
                //console.log( "start create_bar_cart" );
                //*** declare vars
                var chart = {};
                var view_width, view_height = 0;
                var group, groupH, groupW;
                var oridinal_scale, linear_scale;
                var margin;
                var number_of_periods, steps, max_number_of_bars;
                var color_bar, color_text;
                var maximum_in_data = 0;

                //*** Setup dimensons
                margin = params.margin;
                view_height = params.view_height;
                view_width = params.view_width;
                color_bar = params.color_bar;
                color_text = params.color_text;

                //calculate absolut width and height for svg
                groupH = view_height - margin.top - margin.bottom;
                groupW = view_width - margin.left - margin.right;
                //console.log( "groupH: " + groupH );

                //public functions
                //*** create group append it to the timeline
                chart.set_svg_group = function (params) {
                    var id = params.id;
                    var transform_xPos = params.transform_xPos;
                    var transform_yPos = params.transform_yPos;

                    group = d3.select(params.container)
                        .append("g")
                        .attr("id", id)
                        .attr("transform", "translate(" + transform_xPos + "," + transform_yPos + ")"); //move x,y of whole svg.chart
                }

                chart.set_scale = function (array, range_lin, range_ord, in_beteween_space) {

                    linear_scale = d3.scale.linear()
                        .domain([0, d3.max(array)])
                        .range([0, range_lin]);

                    oridinal_scale = d3.scale.ordinal()
                        .domain(d3.range(array.length)) //d3.range(x) returns an array with x elements sorted from 0-x
                        .rangeRoundBands([0, range_ord], in_beteween_space); //5% space between bars
                }

                chart.get_group = function () { return group };
                chart.get_groupH = function () { return groupH };
                chart.get_groupW = function () { return groupW };
                chart.get_oridinal_scale = function () { return oridinal_scale };
                chart.get_linear_scale = function () { return linear_scale };
                chart.get_margins = function () { return margin };
                chart.get_color_bar = function () { return color_bar };
                chart.get_color_text = function () { return color_text };

                chart.create_bars = function () { throw new Error("NOT IMPLEMENTED") };
                chart.update_bars = function () { throw new Error("NOT IMPLEMENTED") };
                chart.labels = function () { throw new Error("NOT IMPLEMENTED") };

                return chart;
            }
            return { create_bar_chart: create_bar_chart };
        }();


        //***************************TIMELINE******************************//
        var BAR_YEARS = function () {
            //console.log( "bar_years start" );
            //@param.data_year = Array 
            //@param.data_amount = Array
            var create_bar_years = function (params) {
                var create_bars, update_bars, create_labels, update_labels;
                var rect, bar_group, bar, clicked_id_bar, clicked_id_text, create_bars, update_bars;
                var btn_group, label_group;
                var data_years, data_amount;
                var xScale, yScale;
                var item_value, item_key;
                var label_width, label_height;

                var data_years_all = params.data_years_all;
                var data_amount_all = params.data_amount_all;
                var color_background_div = params.color_background_div;

                var new_bar_years = CHART.create_bar_chart(params);

                new_bar_years.set_svg_group({
                    id: "chart",
                    transform_xPos: new_bar_years.get_margins().left,
                    transform_yPos: (new_bar_years.get_margins().top + 30) //because it don't includes the space between header and timeline
                });
                var svg = d3.select(params.container);//new_bar_years.get_group();
                var svgH = new_bar_years.get_groupH();
                var svgW = new_bar_years.get_groupW();
                var get_current_displayed_years;
                var count_clicks = 0;

                var label_space = 19;
                //var max_number_of_bars = 30;
                var steps = 5; //number of years that will be shifted if a button was pushed in the timeline
                var overlap = 0.5 //percent how much the background div should extend the lable-width
                var tooltip_subset_height;
                var hoovered_year;
                var ids;

                //check if number of years contained in the data, extend the number of planed bars that will be shown
                if (data_years_all.length > max_number_of_bars) {
                    //console.log( "max_number_of_bars: " + max_number_of_bars );
                    //console.log( "data_years_all.length: " + data_years_all.length );

                    overlap = 0.2;
                    //claculate the number of needed periods that have to be slidable
                    number_of_periods = Math.ceil(((data_years_all.length - 1) - max_number_of_bars) / steps);
                    //console.log( "number_of_periods: " + number_of_periods );

                    data_amount = set_data_period(data_amount_all, 0, steps, max_number_of_bars, number_of_periods);
                    data_years = set_data_period(data_years_all, 0, steps, max_number_of_bars, number_of_periods);
                    current_timeline = data_years;
                    //console.dir( data_years );

                } else {

                    data_amount = data_amount_all;
                    data_years = data_years_all;
                    current_timeline = data_years;

                }

                new_bar_years.set_scale(data_amount, svgH - 45, svgW, 0.2);
                xScale = new_bar_years.get_oridinal_scale();
                yScale = new_bar_years.get_linear_scale();


                //create group for bars
                bar_group = svg.append("g")
                    .attr("class", "bar_group")
                    .on("mouseover", function () {
                        //console.log( "mouseover bar_subset_group" );
                        d3.select(this).style("cursor", "pointer");
                    });

                var bar_highlight = svg.append("g")
                    .attr("class", "bar_subset_group")
                    .on("mouseover", function () {

                        d3.select(this).style("cursor", "pointer");
                    });

                //create group for labels years and move y to the bottom of the chart-svg
                label_group = svg.append("g")
                    .attr("class", "label_group")
                    .attr("transform", "translate(0," + (svgH) + ")")
                    .on("mouseover", function () {
                        //console.log( "mouseover bar_subset_group" );
                        d3.select(this).style("cursor", "pointer");
                    });

                /*btn_group = svg.append( "g" )
                                .attr( "class", "btn_group" ) 
                                .attr("transform", "translate(-15," + (svgH-20) + ")")
                                //.attr("transform", "translate(-5," + svgH + ")")
                                .on( "mouseover", function() {
                                    //console.log( "mouseover bar_subset_group" );
                                    d3.select(this).style("cursor", "pointer");
                                });*/

                var label_height = get_width_of_text_element({ svg: svg, group: label_group, data: dataset_years }).height;

                new_bar_years.get_current_displayed_years = function () { return data_years };

                //according to the number of clicks the right time period will be shwon
                //if the left button will be pushed the count clicks will be increased. 
                //if the right button will be pushed the count clicks will be reduced.
                //if count clicks is 0 the current period will be shown in the timeline
                //@parmas.direction = String "left" or "right" to indicate which button was pushed
                var button_clicked = function (params) {
                    //console.log( "button_clicked aufgerufen" );
                    var direction = params.direction;
                    //console.log( "direction: " + direction );
                    //console.log( "number_of_periods: " + number_of_periods );
                    //console.dir( current_timeline );

                    //according to which button was pushed, increas or reduce the number of clicks
                    //if the current period or the oldest period was reached hide the according button 
                    if (direction === "left") {

                        if (count_clicks < number_of_periods) {
                            //increase the number of clicks as we erase from the current period (current period will be 0)
                            count_clicks++;
                            //show the right button to enable the user to navigate to a more actual period of time
                            d3.select(".btn_right").attr('opacity', '1');

                            //hide the left button if we reach the last period
                            if (count_clicks === number_of_periods) {
                                d3.select(".btn_left").attr('opacity', '0');

                            }
                        }
                    }

                    if (direction === "right") {

                        if (count_clicks !== 0) {
                            //reduce the number of clicks as we converge the current period (current period will be 0)
                            count_clicks--;
                            //show the right button to enable the user to navigate to a more actual period of time
                            d3.select(".btn_left").attr('opacity', '1');

                            //hide the right button if we reach the actual period
                            if (count_clicks === 0) {

                                d3.select(".btn_right").attr('opacity', '0');
                            }
                        }
                    }

                    //console.log( "number of periods: " + number_of_periods );
                    //console.log( "count_clicks: " + count_clicks );

                    //change the data period in the timeline
                    //0 clicks show the current period of time. the higher the clicks the farther away the current period of time
                    data_years = set_data_period(data_years_all, count_clicks, steps, max_number_of_bars, number_of_periods);
                    data_amount = set_data_period(data_amount_all, count_clicks, steps, max_number_of_bars, number_of_periods);

                    update_bars(data_amount, data_years);
                    update_background_divs(data_years);
                    update_labels(data_years);

                    update_tooltip({ data_amount: data_amount, data_years: data_years });

                    timeline_changed = true;
                    current_timeline = data_years;

                    remove_highlight_selection_items_years();
                    highlight_selection_items;
                }

                var create_bars = function () {
                    //console.log( "create_bars start" );  

                    //fill group with bars
                    bar = bar_group.selectAll("rect")
                        .data(data_amount)
                        .enter()
                        .append("rect")
                        .attr({
                            x: function (d, i) { return xScale(i) },
                            y: function (d) { return svgH - yScale(d) - label_space; }, //subtract space for labels to have space for labels ;o)
                            width: xScale.rangeBand(),
                            height: function (d) { return yScale(d); },
                            fill: new_bar_years.get_color_bar(),
                            class: function (d, i) { return "bar " + data_years[i]; },
                            id: function (d, i) {
                                return "bar_" + data_years[i];
                            }
                        })
                        .on("click", function (d, j) {
                            //console.log( "CLICK: create_bars" );

                            item_value = data_years[j].toString();
                            var item_type = "year";

                            item_value = data_years[j].toString();
                            item_key = "years";


                            if (item_already_selected({
                                array: selected_items,
                                list: item_key,
                                value: item_value
                            })) {

                                remove_selected_item({
                                    value: item_value,
                                    key: item_key
                                });
                            } else {

                                add_selected_item({
                                    value: item_value,
                                    key: item_key
                                });


                            }
                        })
                        .on("mouseover", function (d, i) {
                            //console.log( "mouseover create_bar" );

                            hoovered_year = data_years[i].toString();

                            tooltip_change_visibility(hoovered_year, true);

                        })
                        .on("mouseout", function (d, i) {
                            //console.log( "mouseoverout create_bar" );

                            hoovered_year = data_years[i].toString();
                            ids = get_tooltip_ids(hoovered_year).ids;

                            if (d3.select(ids[0]).attr("class") !== "permanent") {
                                //console.log( "class is not permanent" );
                                tooltip_change_visibility(hoovered_year, false);
                            } else {
                                //console.log( "class is permanent" );
                                tooltip_change_visibility(hoovered_year, true);
                            }

                        });
                };

                var create_tooltip = function () {
                    //console.log("tooltip aufgerufen");
                    var distance_to_bar = 3;
                    var selected_dataset = [];

                    tooltip_subset_height = get_width_of_text_element({ svg: svg, group: bar_group, data: data_amount }).height;

                    var tooltips = bar_group.selectAll("text")
                        .data(data_amount)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            y: function (d) { return svgH - yScale(d) /*- label_space - tooltip_subset_height - distance_to_bar*/; }, //3 space between bar and label
                            fill: "black",
                            opacity: 0,
                            "font-weight": "normal",
                            id: function (d, i) { return "tooltip_normal_" + data_years[i]; },
                            "text-anchor": "end"
                        })

                    //if no data is selected we need an array which contains 0 for each selected data 
                    for (var i = 0; i < dataset_amount.length; i++) {
                        selected_dataset.push(0);
                    }

                    var tooltips_subset = bar_highlight.selectAll("text")
                        .data(data_amount)
                        .enter()
                        .append("text")
                        .text(function (d, i) { return selected_dataset[i]; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            y: function (d) { return svgH - yScale(d) - label_space - distance_to_bar; }, //3 space between bar and label
                            fill: "black",
                            opacity: 0,
                            id: function (d, i) { return "tooltip_subset_" + data_years[i]; },
                            "font-weight": "bold",
                            "text-anchor": "end"
                        })
                }

                var update_tooltip = function (params) {
                    //console.log("update tooltip aufgerufen");
                    var data_amount = params.data_amount;
                    var dataset_years = params.data_years;
                    var selected_dataset = params.selected_dataset;
                    var distance_to_bar = 3;

                    var tooltips = bar_group.selectAll("text")
                        .data(data_amount)
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            y: function (d) { return svgH - yScale(d) /*- label_space - tooltip_subset_height - distance_to_bar*/; }, //3 space between bar and label
                            fill: "black",
                            opacity: 0,
                            id: function (d, i) { return "tooltip_normal_" + dataset_years[i]; },
                            "font-weight": "normal",
                            class: "tooltip_normal",
                            "text-anchor": "end"
                        })

                    if (selected_dataset === undefined) {

                        selected_dataset = [];
                        for (var i = 0; i < data_amount.length; i++) {
                            selected_dataset.push(0);
                        }
                    }

                    var tooltips_subset = bar_highlight.selectAll("text")
                        .data(data_amount)
                        .text(function (d, i) { return selected_dataset[i]; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            y: function (d) { return svgH - yScale(d) - label_space - distance_to_bar; }, //3 space between bar and label
                            fill: "black",
                            opacity: 0,
                            id: function (d, i) { return "tooltip_subset_" + dataset_years[i]; },
                            "font-weight": "bold",
                            class: "tooltip_subset",
                            "text-anchor": "end"
                        })
                }

                var update_bars = function (dataset_amount, dataset_years) {
                    //console.log( "update_bars aufgerufen" );

                    update_tooltip({ data_amount: dataset_amount, data_years: dataset_years });

                    //fill group with bars
                    bar = bar_group.selectAll("rect")
                        .data(dataset_amount)
                        .attr({
                            y: function (d) { return svgH - yScale(d) - label_space; }, //subtract space for labels to have space for labels ;o)
                            x: function (d, i) { return xScale(i) },
                            width: xScale.rangeBand(),
                            height: function (d) { return yScale(d); },
                            fill: new_bar_years.get_color_bar(),
                            class: "bar",
                            id: function (d, i) {
                                return "bar_" + dataset_years[i];
                            }
                        })
                        .on("click", function (d, j) {
                            //console.log( "CLICK: update_bars" );

                            item_value = data_years[j].toString();
                            item_key = "years";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                remove_selected_item({ value: item_value, key: item_key });
                            } else {

                                add_selected_item({ value: item_value, key: item_key });

                            }

                        })
                        .on("mouseover", function (d, i) {
                            //console.log( "mouseover update_bars" );

                            hoovered_year = data_years[i].toString();
                            tooltip_change_visibility(hoovered_year, true);


                        })
                        .on("mouseout", function (d, i) {
                            //console.log( "mouseoverout update_bars" );

                            hoovered_year = data_years[i].toString();
                            ids = get_tooltip_ids(hoovered_year).ids;

                            if (d3.select(ids[0]).attr("class") !== "permanent") {
                                //console.log( "class is permanent" );
                                tooltip_change_visibility(hoovered_year, false);
                            } else {
                                //console.log( "class is permanent" );
                                tooltip_change_visibility(hoovered_year, true);
                            }

                        });
                };

                var create_bars_subset = function () {
                    //console.log( "create_bars_subset start" );  

                    //fill group with bars
                    bar = bar_highlight.selectAll("rect")
                        .data(data_amount)
                        .enter()
                        .append("rect")
                        .attr({
                            x: function (d, i) { return xScale(i) },
                            y: function (d) { return svgH - yScale(d) - label_space; }, //subtract space for labels to have space for labels ;o)
                            width: xScale.rangeBand(),
                            height: function (d) { return yScale(d); },
                            opacity: 0,
                            class: function (d, i) { return "bar subset " + data_years[i]; },
                            id: function (d, i) {
                                return "bar_subset" + data_years[i];
                            }
                        })
                        .on("click", function (d, j) {

                            item_value = data_years[j].toString();
                            item_key = "years";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });


                            }
                        })
                        .on("mouseover", function (d, i) {
                            //console.log( "mouseover: create_bars_subset" );

                            hoovered_year = data_years[i].toString();
                            tooltip_change_visibility(hoovered_year, true);

                        })
                        .on("mouseout", function (d, i) {
                            //console.log( "mouseoverOut: create_bars_subset" );

                            hoovered_year = data_years[i].toString();
                            ids = get_tooltip_ids(hoovered_year).ids;

                            if (d3.select(ids[0]).attr("class") !== "permanent") {
                                //console.log( "class is not permanent" );
                                tooltip_change_visibility(hoovered_year, false);
                            } else {
                                //console.log( "class is permanent" );
                                tooltip_change_visibility(hoovered_year, true);
                            }
                        });
                };

                new_bar_years.highlight_subset = function (data_selected) {
                    //console.log( "years: highlight_subset aufgerufen" );

                    update_tooltip({ selected_dataset: data_selected, data_amount: data_amount, data_years: data_years });

                    bar = bar_highlight.selectAll("rect")
                        .data(data_selected)
                        .attr({
                            x: function (d, i) { return xScale(i) },
                            y: function (d) { return svgH - yScale(d) - label_space; }, //subtract space for labels to have space for labels ;o)
                            width: xScale.rangeBand(),
                            height: function (d, i) {
                                ids = get_tooltip_ids(data_years[i]).ids;
                                var item_label = "#label_year_" + data_years[i];

                                if (yScale(d) > 0) {
                                    tooltip_change_visibility(data_years[i], true);
                                    d3.select(ids[0]).attr("class", "permanent");
                                    d3.select(ids[1]).attr("class", "permanent");
                                    //d3.select( item_label ).style( "font-weight", "900" );
                                    //console.log( "item_label fett: " + item_label );

                                } else {
                                    d3.select(ids[0]).attr("class", "");
                                    d3.select(ids[1]).attr("class", "");
                                    //d3.select( item_label ).style( "font-weight", "300" );
                                    //console.log( "item_label nicht fett: " + item_label );
                                }
                                return yScale(d);
                            },
                            fill: highligth_color, //selection_color,


                            opacity: 1,
                            class: function (d, i) { return "bar subset highlight " + data_years[i]; },
                            id: function (d, i) {
                                return "bar_subset" + data_years[i];
                            }
                        })
                        .on("click", function (d, j) {
                            //console.log( "CLICK: highlight_subset_bar" );

                            item_value = data_years[j].toString();
                            item_key = "years";

                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                remove_selected_item({ value: item_value, key: item_key });
                                tooltip_change_visibility(item_value, false);
                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                                tooltip_change_visibility(item_value, true);
                            }
                        })
                };

                var create_background_divs = function () {
                    //console.log( "create_background_divs" );
                    var background_div;

                    label_width = get_width_of_text_element({ svg: svg, group: label_group, data: data_years }).width;
                    label_height = get_width_of_text_element({ svg: svg, group: label_group, data: data_years }).height;


                    background_div = label_group.selectAll("rect")
                        .data(data_years)
                        .enter()
                        .append("rect")
                        .text(function (d) { return d; })
                        .attr({
                            //x: function (d, i) { return xScale(i) - ((label_width * overlap / 2)) },
                            x: 0,
                            y: 0 - label_height - 4,
                            id: function (d, i) { return "background_div_" + d },
                            width: xScale.rangeBand() + (label_width * overlap),
                            height: label_height,
                            fill: color_background_div
                        })
                        .on("click", function (d, j) {

                            item_value = data_years[j].toString();
                            item_key = "years";

                            //add selected item to selectionArray
                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                remove_selected_item({ value: item_value, key: item_key });
                            } else {

                                add_selected_item({ value: item_value, key: item_key });

                            }

                        })
                };

                var update_background_divs = function (dataset_years) {
                    //console.log( "update_background_divs" );
                    var background_div;

                    //console.dir( dataset_years );

                    //label_width = //get_width_of_text_element({ svg: svg, group: label_group, data: dataset_years }).width;
                    //label_height = //get_width_of_text_element({ svg: svg, group: label_group, data: dataset_years }).height;

                    //console.log( "label_width" + label_width );
                    //console.log( "label_height" + label_height );

                    /*label_group.on( "click", function( d, j ) { 
                                    console.log( "click label_group" );
                                    console.log( "d3.select(this).attr('id'): " + d3.select(this).attr('class') );
                                    console.dir( d3.select(this) );
                                })*/

                    background_div = label_group.selectAll("rect")
                        .data(dataset_years)
                        //.enter()
                        //.append( "rect" )
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return xScale(i) - ((label_width * overlap / 2)) },
                            y: 0 - label_height - 4,
                            id: function (d, i) { return "background_div_" + d },
                            width: xScale.rangeBand() + (label_width * overlap), //label_width + ( label_width * overlap ),
                            height: label_height,
                            fill: color_background_div
                        })
                        .on("click", function (d, j) {

                            item_value = dataset_years[j].toString();
                            item_key = "years";

                            //add selected item to selectionArray
                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                //console.log( "arleady sel" );
                                remove_selected_item({ value: item_value, key: item_key });
                            } else {

                                add_selected_item({ value: item_value, key: item_key });

                            }

                        });
                };

                var create_labels = function () {
                    //console.log( "create_labels aufgerufen" );
                    var labels;
                    //var label_height = get_width_of_text_element({ svg: svg, group: label_group, data: dataset_years }).height;
                    //console.log( "lable_height: " + label_height );
                    //create labels for years
                    labels = label_group.selectAll("text")
                        .data(data_years)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            // y: -label_height / 2,
                            y: 0,
                            fill: new_bar_years.get_color_text(),
                            class: "labels",
                            "text-anchor": "middle",
                            id: function (d, i) { return "label_year_" + d; }
                        })
                        .on("click", function (d, j) {

                            item_value = data_years[j].toString();
                            item_key = "years";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {
                                //console.log( "arleady sel" );

                                d3.select(this).attr("fill", new_bar_years.get_color_text());
                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                                d3.select(this).attr("fill", selection_color);

                            }

                        });
                };

                var update_labels = function (dataset_years) {
                    //console.log( "update_labels aufgerufen" );
                    //var label_height = get_width_of_text_element({ svg: svg, group: label_group, data: dataset_years }).height;
                    //create labels for years
                    labels = label_group.selectAll("text")
                        .data(dataset_years)
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return xScale(i) + (xScale.rangeBand() / 2) },
                            y: -label_height / 2, //cause of grouping and transform of the labels_group
                            fill: new_bar_years.get_color_text(),
                            class: "labels",
                            "text-anchor": "middle",
                            id: function (d, i) { return "label_year_" + d; }
                        })
                        .on("click", function (d, j) {

                            item_value = data_years[j].toString();
                            item_key = "years";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {
                                console.log("arleady sel");
                                remove_selected_item({ value: item_value, key: item_key });
                            } else {

                                add_selected_item({ value: item_value, key: item_key });

                            }

                        });
                };

                var create_buttons = function () {
                    var btn_left, btn_right, btn_group, buttons_text = [], background_div, buttons, buttons_width, buttons_height;

                    buttons_text = ["<", ">"];


                    btn_group = svg.append("g")
                        //.attr("transform", "translate(-5," + (svgH-19) + ")");
                        .attr("class", "btn_group")
                        .attr("opacity", "1")
                        .attr("transform", "translate(-15," + (svgH) + ")")
                        .on("mouseover", function () {
                            d3.select(this).style("cursor", "pointer");
                        })

                    //.attr("transform", "translate(-" + buttons_width + "," + (svgH-19) + ")");

                    //buttons_width = get_width_of_text_element({ svg: svg, group: btn_group, data: buttons_text }).width;
                    buttons_height = get_width_of_text_element({ svg: svg, group: btn_group, data: buttons_text }).height;

                    //console.log( "buttons_width: " + buttons_width );
                    //console.log( "svgW: " + svgW );


                    background_div = btn_group.selectAll("rect")
                        .data(buttons_text)
                        .enter()
                        .append("rect")
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return i * (svgW + 10) }, //later to include the width of the button image
                            y: 0 - label_height - 4,
                            id: function (d, i) { return d },
                            class: function (d, i) {
                                if (d === "<") {
                                    return "btn_left"
                                } else {
                                    return "btn_right"
                                }
                            },
                            width: 20,//buttons_width,
                            height: label_height,
                            fill: color_background_div
                        })
                        .on("click", function (d, j) {
                            //console.log( "hit background_div: " + d );
                            if (d === "<") {
                                button_clicked({ direction: "left" });
                            } else {
                                button_clicked({ direction: "right" });

                            }
                        });


                    buttons = btn_group.selectAll("text")
                        .data(buttons_text)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            x: function (d, i) { return i * (svgW + 10) + 7 }, //later to include the width of the button image
                            y: -label_height / 2,
                            id: function (d, i) { return d },
                            class: function (d, i) {
                                if (d === "<") {
                                    return "btn_left"
                                } else {
                                    return "btn_right"
                                }
                            },
                            "text-anchor": "start",
                            fill: new_bar_years.get_color_text()
                        })
                        .style("font-weight", "600")
                        .on("click", function (d, j) {
                            //console.log( "hit text: " + d );
                            if (d === "<") {
                                button_clicked({ direction: "left" });
                            } else {
                                button_clicked({ direction: "right" });

                            }
                        });

                    //at the beginning show only the left button, cause we will alway start showing the current year
                    d3.select(".btn_right").attr('opacity', '0');

                };

                new_bar_years.render = function () {
                    create_bars();
                    create_tooltip();
                    create_bars_subset();
                    //create_background_divs();
                    create_labels();

                    if ((data_years_all.length - 1) >= max_number_of_bars + 1) {
                        create_buttons();
                        //d3.select( ".btn_right" ).attr('opacity', '0');
                    }

                }

                return new_bar_years;
            };

            return { create_bar_years: create_bar_years };
        }();

        //***************************TYPES******************************//
        var BAR_TYPE = function () {

            var create_bar_type = function (params) {
                //based on CHART
                //with new code for bars and labels
                var xScale, yScale, svg, svgH, svgW;
                var all_entry_types = [];
                var entry_types_text = [];
                var new_bar_types;
                var bar, bar_group, label_group, data_label_group, line_group;
                var distance_label_to_bars = -10;
                var label_height, label_space;

                label_space = 50;
                new_bar_types = CHART.create_bar_chart(params);
                all_entry_types = params.all_entry_types;
                entry_types_text = params.entry_types_text;

                new_bar_types.set_svg_group({
                    id: "type_chart",
                    transform_xPos: (0),
                    transform_yPos: (0 + 30) //because it don't includes the space between header and timeline
                });
                svg = d3.select(params.container);//new_bar_types.get_group();
                svgH = new_bar_types.get_groupH();
                svgW = new_bar_types.get_groupW();

                //new_bar_years.set_scale( data_amount, svgH, svgW, 0.2 ); 
                new_bar_types.set_scale(all_entry_types, (svgW / 2), svgH, 0);
                xScale = new_bar_types.get_linear_scale();
                yScale = new_bar_types.get_oridinal_scale();
                text_color_for_types = new_bar_types.get_color_text();

                //create svg-group
                bar_group = svg.append("g")
                    .attr("class", "bar_group")
                    .on("mouseover", function () {
                        //console.log( "mouseover bar_group" );
                        d3.select(this).style("cursor", "pointer");
                    });

                var bar_highlight = svg.append("g")
                    .attr("class", "bar_subset_group")
                    .on("mouseover", function () {
                        //console.log( "mouseover bar_subset_group" );
                        d3.select(this).style("cursor", "pointer");
                    });

                //create group for labels years and move y to the bottom of the chart-svg
                label_group = svg.append("g")
                    .attr("class", "label_group")
                    .on("mouseover", function () {
                        //console.log( "mouseover label_group" );
                        d3.select(this).style("cursor", "pointer");
                    });

                data_label_group = svg.append("g")
                    .attr("class", "data_label_group");

                var data_lbl_subset_group = svg.append("g")
                    .attr("class", "data_lbl_subset_group");

                line_group = svg.append("g")
                    .attr("class", "line_group");

                label_height = get_width_of_text_element({ svg: svg, group: label_group, data: entry_types_text }).height;
                //var bar_height = get_width_of_text_element({ svg: svg, group: bar_group, data: all_entry_types }).height;
                //console.log( "bar_height: " + bar_height );

                var create_bars_total = function () {
                    //console.log("create_bars_total in BAR_TYP aufgerufen");
                    bar = bar_group.selectAll("rect")
                        .data(all_entry_types)
                        .enter()
                        .append("rect")
                        .attr({
                            x: 0,
                            y: function (d, i) { return yScale(i) },
                            width: function (d) { return xScale(d); },
                            height: yScale.rangeBand(),
                            fill: new_bar_types.get_color_bar(),
                            class: "bar_type",
                            id: function (d, i) {
                                return "bar_type_" + i;
                            }
                        })
                        .on("click", function (d, i) {

                            item_value = entry_types_text[i].toString();
                            item_key = "types";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                console.log("arleady sel");
                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                            }

                        });
                };

                var create_bars_subset = function () {
                    //console.log( "create_bars_subset aufgerufen" );

                    bar = bar_highlight.selectAll("rect")
                        .data(all_entry_types)
                        .enter()
                        .append("rect")
                        .attr({
                            x: 0,
                            y: function (d, i) { return yScale(i) },
                            width: function (d) { return xScale(d); },
                            height: yScale.rangeBand(),
                            fill: new_bar_types.get_color_bar(),
                            class: "bar_type_highlight",
                            id: function (d, i) {
                                return "bar_type_highlight" + i;
                            }
                        })
                        .on("click", function (d, i) {

                            item_value = entry_types_text[i].toString();
                            item_key = "types";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                console.log("arleady sel");
                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                            }
                        })
                };

                new_bar_types.highlight_subset = function (data_selected) {
                    //console.log( "types: highlight_subset aufgerufen" );
                    var type_lable_id, id;

                    bar = bar_highlight.selectAll("rect")
                        .data(data_selected)
                        .attr({
                            x: 0,
                            y: function (d, i) { return yScale(i) },
                            //width: function( d ){ return xScale( d ); },
                            width: function (d, i) {
                                /* needed if labels of matching typs should be bold
                                 type_label_id = generate_words_id({ text: entry_types_text[i], group: "type", element: "text" }).exist_id;
                                 
                                 if ( xScale( d ) > 0 ){
                                     d3.select( type_label_id ).style( "font-weight", "900" );

                                 }else{
                                     d3.select( type_label_id ).style( "font-weight", "300" );
                                 }*/
                                return xScale(d);
                            },

                            height: yScale.rangeBand(),
                            fill: highligth_color, //selection_color,
                            class: "bar_type_highlight",
                            id: function (d, i) {
                                id = generate_words_id({ text: entry_types_text[i], group: "type", element: "div" }).new_id;
                                //console.log( "id: " + id );
                                return id;
                                //return "bar_type_highlight" + i; 
                            }
                        })
                        .on("click", function (d, i) {

                            item_value = entry_types_text[i].toString();
                            item_key = "types";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                //console.log( "arleady sel" );
                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                            }
                        })

                    highlight_data_lbl_subset(data_selected);
                };

                var create_selection_divs = function () {
                    var label_height = get_width_of_text_element({ svg: svg, group: label_group, data: entry_types_text }).height;
                    var selection_div,
                        //var label_height;

                        //label_width = get_width_of_text_element({ svg: svg, group: label_group, data: entry_types_text }).width;

                        selection_div = label_group.selectAll("text")
                            .data(entry_types_text)
                            .enter()
                            .append("text")
                            .text(function (d) { return d; })
                            .attr({
                                // y: function (d, i) { return yScale(i) + label_height + (label_height / 2) * (-1) },
                                y: function (d, i) { return yScale(i) + 0.5 * yScale(1) },
                                // x: function (d, i) { return (d.length * 6 - distance_label_to_bars) * (-1) },
                                x: function (d, i) {
                                    //console.log(d, d.length)
                                    return -1.0 * d.length * 6;
                                },
                                id: function (d, i) {
                                    if (d === "Part of a Book") {
                                        return "background_div_type_Part_of_a_Book";
                                    } else {
                                        return "background_div_type_" + d;
                                    }
                                },
                                //width: function (d, i) { return d.length * 6 },//label_width,
                                //height: label_height,
                                fill: "#000000",//selection_color,
                                anchor: "end",
                                opacity: 1
                            })
                            .on("click", function (d, i) {

                                item_value = entry_types_text[i].toString();
                                item_key = "types";


                                if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                    //console.log( "arleady sel" );
                                    remove_selected_item({ value: item_value, key: item_key });

                                } else {

                                    add_selected_item({ value: item_value, key: item_key });
                                }
                            });
                };

                var create_labels = function () {
                    var labels, data_lbl, id;

                    labels = label_group.selectAll("text")
                        .data(entry_types_text)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            // y: function (d, i) { return yScale(i) + label_height + (label_height / 3) },
                            y: function (d, i) { return yScale(i) + 0.5 * yScale(1) },
                            x: distance_label_to_bars,
                            fill: new_bar_types.get_color_text(),
                            class: "label_type",
                            "text-anchor": "end",
                            id: function (d, i) {
                                id = generate_words_id({ text: d, group: "type", element: "text" }).new_id;
                                //console.log( "id: " + id );
                                return id;
                                /*if ( d === "Part of a Book") { 
                                    return "lbl_type_Part_of_a_Book"; 
                                } else {
                                    return "lbl_type_" + d; 
                                }*/
                            }
                        })
                        .on("click", function (d, i) {

                            item_value = entry_types_text[i].toString();
                            item_key = "types";


                            if (item_already_selected({ array: selected_items, list: item_key, value: item_value })) {

                                //console.log( "arleady sel" );
                                remove_selected_item({ value: item_value, key: item_key });

                            } else {

                                add_selected_item({ value: item_value, key: item_key });
                            }
                        });


                    data_lbl = data_label_group.selectAll("text")
                        .data(all_entry_types)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            y: function (d, i) { return yScale(i) + 0.5 * yScale(1)/*+ label_height + (label_height / 3)*/ },
                            x: (svgW / 2 + label_space - 6),
                            fill: new_bar_types.get_color_text(),
                            class: "lbl_text_data",
                            "text-anchor": "end"
                        })
                };

                var create_data_lbl_subset = function () {
                    var data_lbl_subset = data_lbl_subset_group.selectAll("text")
                        .data(all_entry_types)
                        .enter()
                        .append("text")
                        .text(function (d) { return d; })
                        .attr({
                            y: function (d, i) { return yScale(i) + 0.5 * yScale(1) /*+ label_height + (label_height / 3)*/ },
                            x: (svgW / 2 + (label_space / 2)),
                            fill: "white",
                            class: "lbl_text_data",
                            "text-anchor": "end"
                        })
                }

                var highlight_data_lbl_subset = function (data_selected) {
                    data_lbl_subset = data_lbl_subset_group.selectAll("text")
                        .data(data_selected)
                        .text(function (d) { return d; })
                        .attr({
                            y: function (d, i) { return yScale(i) + 0.5 * yScale(1) /*+ label_height + (label_height / 3)*/ },
                            x: (svgW / 2 + (label_space / 2)),
                            fill: new_bar_types.get_color_text(),
                            "font-weight": "bold",
                            class: "lbl_text_data_subset",
                            "text-anchor": "end"
                        })
                }

                var create_lines = function () {
                    var lines, vertical_line;

                    lines = line_group.selectAll("line")
                        .data(all_entry_types)
                        .enter()
                        .append("line")
                        .attr({
                            x1: 0,
                            y1: function (d, i) { return yScale(i) + yScale.rangeBand() },
                            x2: svgW / 2 + label_space,
                            y2: function (d, i) { return yScale(i) + yScale.rangeBand() },
                            "shape-rendering": "crispEdges",
                            "stroke": "#898989",
                            "stroke-width": "0,3"
                        })

                    vertical_line = line_group//.selectAll( "line" )
                        //.data( all_entry_types )
                        //.enter()
                        .append("line")
                        .attr({
                            x1: 0,
                            y1: 2,//function( d, i ){ return yScale( i ) + yScale.rangeBand() },
                            x2: 0,
                            y2: yScale.rangeBand() * entryTypes_grouped_text.length,//function( d, i ){ return yScale( i ) + yScale.rangeBand()},
                            "class": "vertical_line",
                            "shape-rendering": "crispEdges",
                            "stroke": "#898989",
                            "stroke-width": "0,3"
                        })
                };


                new_bar_types.render = function () {
                    create_bars_total();
                    create_bars_subset();
                    create_data_lbl_subset();
                    create_selection_divs();
                    create_labels();
                    create_lines();
                }
                return new_bar_types;
            };


            return { create_bar_type: create_bar_type };
        }();

        var AMOUNT = function (params) {
            //console.log( "amount aufgerufen" );
            var amount;
            var total_nb = params.total;
            var selected_nb = params.selected;
            var margin = params.margin;
            var color_text = params.color_text;
            var text_size = "23px";//params.text_size;
            var width = params.width;
            //desktop: postion of total amount amount in the center (no selection number is displayed)
            var xPos_amount = 300//width/2 - margin.left - (space_between_view) - 20; //20 because of the space for the types_labels
            //desktop: postion of total amoung when selection number is displayed
            var new_xPos_amount = xPos_amount + 30;
            //desktop: xPos of the slash
            var xPos_slash = new_xPos_amount + 5;

            //according to the size of the screen the max_number_of_bars will be 30(desktop), 15 (tablett), 10(smartphone) or 5 
            //tablett
            /*if ( max_number_of_bars === 15 ) { 
                text_size = "23px";
                new_xPos_amount = xPos_amount + 20;
                xPos_slash = xPos_amount +3;

            }*/
            /* if ( ( max_number_of_bars === 10 ) ) { //so max_number_of_bars will be 10
                 text_size = "20px";
                 new_xPos_amount = xPos_amount + 10;
                 xPos_slash = xPos_amount +3;

             } */
            //smartphone
            /*if ( ( max_number_of_bars === 5 ) ) { 
                text_size = "20px";
                xPos_amount = 150;//width/2 - margin.left - (space_between_view) - 10; //10 because of the space for the types_labels
                new_xPos_amount = xPos_amount + 8;
                xPos_slash = xPos_amount +1;

            }*/



            var amount = d3.select("#amount")
                .append("g")
                .attr("id", "amount")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            var selected_amount = d3.select("#lbl_selected_amount")
            .text(total_nb)

            var total_amount = d3.select("#lbl_total_amount") //amount.append("text")
                .text(total_nb)

            var update_selected_amount = function (params) {
                var new_selected_nb = params.selected_new;
                //var format_nb = zeroFilled = ('000' + new_selected_nb).substr(-3); will draw zeros if number has less than three digits
                //new_selected_nb += " / ";

                if (new_selected_nb === 0) {
                    d3.select("#lbl_selected_amount").attr("fill", color_text);
                } else {
                    d3.select("#lbl_selected_amount").attr("fill", selection_color);
                }

                d3.select("#lbl_total_amount").attr("x", new_xPos_amount + 20);
                d3.select("#lbl_selected_amount").text(new_selected_nb);
                d3.select("#lbl_selected_amount").attr("opacity", "1");
                d3.select("#lbl_slash_amount").attr("opacity", "1");

            }

            return { update_selected_amount: update_selected_amount };
        }

        //****************************CLOUDS******************************// 

        //@params.type = "keywords" or "authors" (only this two types are allowed!)
        var CLOUD = function (params) {
            //console.log( "cloud aufgerufen" );
            var type = params.type //to distinguish if a keyword was clicked or an author
            var wordcloud_authors, wordcloud_keywords;
            //var size = [450, 340];
            var size = params.size;
            var margin = 10;
            var update = false;
            var fontSize = 12;
            var dataset_words = params.words;
            //console.dir( dataset_words );
            //console.log( "dataset_words[0].long_text: " + dataset_words[0].long_text );
            var xPos = params.xPos;
            var yPos = params.yPos;
            var id_name = type;
            var selection = params.selection;
            var color_text = params.color_text;

            if (dataset_words !== 0) {
                fontSize = d3.scale.log().domain([dataset_words[(dataset_words.length - 1)].size, dataset_words[0].size])
                    .range([15, 40])
                    .clamp(true);
            }

            if (selection !== undefined) {
                update = true;
            }

            var cloud_authors = d3.select("#cloud_authors")
                .append("g")
                .attr("id", id_name)
                //.attr("transform", "translate(" + (xPos + margin) + "," + (yPos + margin) + ")")
                .attr("width", size[0])
                .attr("height", size[1])
                .append("g")
                .attr("transform", "translate(" + (size[0] / 2) + "," + (size[1] / 2) + ")")
                .on("mouseover", function () {
                    //console.log( "mouseover cloud" );
                    d3.select(this).style("cursor", "pointer");
                });

            var cloud_keywords = d3.select("#cloud_keywords")
                .append("g")
                .attr("id", id_name)
                //.attr("transform", "translate(" + (xPos + margin) + "," + (yPos + margin) + ")")
                .attr("width", size[0])
                .attr("height", size[1])
                .append("g")
                .attr("transform", "translate(" + (size[0] / 2) + "," + (size[1] / 2) + ")")
                .on("mouseover", function () {
                    //console.log( "mouseover cloud" );
                    d3.select(this).style("cursor", "pointer");
                });

            if (update === false) {
                d3.layout.cloud()
                    .size(size)
                    .words(dataset_words)
                    .fontSize(function (d) { return fontSize(+d.size); })
                    .rotate(function () { return ~~(Math.random()) * 90; })
                    .on("end", draw)
                    .start();
            }

            function draw(words) {
                //console.log( "draw aufgerufen" );
                var txt, id;
                var iem_text, item_id;

                //console.log( "words.length: " + words.length );
                //console.dir( words );

                if (type === "keywords") {

                    //console.log( "type of cloud = keywords" );
                    id_name = "keywords";
                    //save the list with all words that are really displayed 
                    //(if too much words have been contained in the given words-arr, d3 would reduce them in the  )
                    words_displayed = save_wordtext_and_wordid({ array: words, id: id_name });
                    //console.log( "words_displayed" );
                    //console.dir( words_displayed );

                } else if (type === "authors") {

                    //console.log( "type of cloud = authors" );
                    id_name = "authors";
                    //save the list with all words that are really displayed
                    authors_displayed = save_wordtext_and_wordid({ array: words, id: id_name });
                    //console.log( "authors_displayed.length: " + authors_displayed.length );

                    //if there is not enough space for the authors, the limit function will be called to cut of the authors according to their 
                    //number of publication. Thus an arbitrary disappearance of names can be avoided
                    if (authors_displayed.length < authors.length) {
                        //console.log( "too less space >> limit authors again from : "+ authors.length + " to: " + authors_displayed.length );

                        //find new length for authors according to the size of the author which is on the position of the authors_displayed.length
                        authors = limit_words({ words: authors, optimum_size: authors_displayed.length, min: 1 });
                        //update authors_displaxed to new length
                        authors_displayed = save_wordtext_and_wordid({ array: authors, id: id_name });;
                        //change words.length to the new length 
                        words.length = authors.length;

                    }

                    //console.dir( authors_displayed );
                } else {
                    console.log("WARNING: type of cloud is not determined! Please add the params.key 'type' with the value-stirng if the cloud is for 'authors' or 'keywords' '");
                }

                if (!update) {
                    //console.log("its no update");
                    var wordcloud;
                    if (type === "authors") {
                        wordcloud = cloud_authors.selectAll("text")
                            .data(words);
                    } else if (type === "keywords") {
                        wordcloud = cloud_keywords.selectAll("text")
                            .data(words);
                    }
                    wordcloud.enter()
                        .append("text")
                        .style("font-size", function (d) { return d.size + "px"; })
                        .style("fill", color_text)
                        .attr("text-anchor", "middle")
                        .attr("id", function (d) {

                            txt = d.text;
                            id = generate_words_id({ text: txt, group: id_name, element: "text" }).new_id;
                            return id;
                        })
                        .attr("transform", function (d) {
                            return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                        })
                        .style("font-weight", "300")
                        .text(function (d) { return d.text; })
                        .on("click", function (d) {
                            //console.log( "call: clicked keyword" );

                            item_value = generate_words_id({ text: d.text, group: id_name, element: "text" }).exist_id;
                            item_key = id_name;

                            //console.log( "item_value: " + item_value );
                            //console.log( "id_name: " + id_name );

                            if (item_already_selected({
                                array: selected_items,
                                list: item_key,
                                value: item_value
                            })) {

                                //console.log("before remove item");
                                remove_selected_item({
                                    value: item_value,
                                    key: item_key
                                });
                            } else {
                                //console.log("before add item");
                                add_selected_item({
                                    value: item_value,
                                    key: item_key
                                });
                            }

                        })
                        .append("title") //show text on hover
                        .text(function (d) {
                            var text;

                            for (var i = 0; i < dataset_words.length; i++) {

                                if (dataset_words[i].text === d.text) {

                                    if (type === "keywords") {
                                        text = dataset_words[i].long_text + ", found: " + dataset_words[i].size + "x";
                                        return text;
                                    }

                                    if (type === "authors") {
                                        text = dataset_words[i].text + ", found: " + dataset_words[i].size + "x";
                                        return text;
                                    }
                                }
                            }

                        });
                }
            }
        }

        //*****************************LIST******************************// 

        //changes Pauli button abstract           
        var LIST = function (params) {
            var data = params.data;
            var update = params.update;
            var offset;

            if (!update) {
                $('#list').append("<div id='s_acc'><div class='accordion'></div></div>");
                generate(sort_by);
            } else {
                $('#list').replaceWith("<div id='list'><div id='s_acc'><div class='accordion'></div></div></div>");
                generate(sort_by);
            }

            //if no color is defined, take a default
            var btn_color = (params.button_color === undefined || params.button_color === "") ? "#333333" : params.button_color;

            /*$( "#year" ).css("background-color", btn_color );
            $( "#type" ).css("background-color", btn_color );*/

            //set the same margin-left as the svg do
            /*offset = $( "#pubVis" ).offset();
            $( "#list" ).css("margin-left", offset.left);*/

            d3.select("#btn_type")
                .on("click", function () {
                    if (sort_by_year) {
                        sort_by_year = false;
                        $("#btn_year").css({
                            "border-right": "5px solid #d9d9d9"
                        });
                        sort_by = 0;
                        generate(sort_by);
                    } else {
                        sort_by_year = true;
                        sort_by_type = false;
                        $("#btn_year").css({
                            "border-right": "5px solid " + selection_color
                        });
                        $("#btn_type").css({
                            "border-right": "5px solid #d9d9d9"
                        });
                        sort_by = 2;
                        generate(sort_by);
                    }
                })

            d3.select("#btn_year")
                .on("click", function () {
                    if (sort_by_type) {
                        sort_by_type = false;
                        $("#btn_type").css({
                            "border-right": "5px solid #d9d9d9"
                        });
                        sort_by = 0;
                        generate(sort_by);
                    } else {
                        sort_by_type = true;
                        sort_by_year = false;
                        $("#btn_type").css({
                            "border-right": "5px solid " + selection_color
                        });
                        $("#btn_year").css({
                            "border-right": "5px solid #d9d9d9"
                        })
                        sort_by = 1;
                        generate(sort_by);
                    }
                })

            d3.select("#txt_sortByYear").attr("fill", (sort_by == 1 ? selection_color : "#d9d9d9"));
            $("#btn_year").css({ "border-right": "5px solid " + (sort_by == 1 ? selection_color : "#d9d9d9") });
            d3.select("#txt_sortByType").attr("fill", (sort_by == 2 ? selection_color : "#d9d9d9"));
            $("#btn_type").css({ "border-right": "5px solid " + (sort_by == 2 ? selection_color : "#d9d9d9") });

            function generate(sortBy) {

                this.sortBy = sortBy;
                //console.log('generate',sortBy);

                function subgenerate() {

                    var type;
                    var url;
                    var abs;
                    var title;
                    var author;
                    var notes;
                    var journal;
                    var conf_title;
                    var book_title;
                    var article_details = "";
                    var conf_details = "";
                    var book_details = "";
                    var thesis_details = "";
                    var first = true;
                    var thesis_type;
                    var details = ""; //all information that will be contained in the folding box

                    if (data[j].list_authors != undefined) {
                        author = data[j].list_authors;
                    } else {
                        author = "<i style='font-style: italic;'>Unknown Author</i>";
                    }

                    if (data[j].entryTags['title'] != undefined) {
                        title = "<span style='font-weight: bold;'>" + data[j].entryTags['title'] + "</span>";
                    } else {
                        title = '<i>Unknown Title</i>';
                    }

                    if (data[j].entryTags['url'] != undefined) {
                        url = "     <a target='_blank' style='float: right;' href='" + data[j].entryTags['url'] + "'><svg version='1.1' baseProfile='basic' id='Ebene_1'xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='22px' height='22px' viewBox='0 0 22 22' xml:space='preserve' class='download'><g><g><path d='M11.31,5.236l-4.161,8.315l-4.16-8.315H11.31z'/></g><rect x='2.928' y='13.591' width='8.433' height='0.943'/></g></svg></a>";
                    } else {
                        url = '';
                    }

                    type = cap(data[j].entryType);

                    if (data[j].entryTags['notes'] != undefined) {

                        notes = "<br>&nbsp" + data[j].entryTags['notes'];

                    } else {

                        notes = "";

                    }




                    //prepare additional data for the detail view (folding box) in the list
                    //details are depending on the types
                    //article: [VOLUME(NUMBER):PAGEFROM-PAGETO]
                    if (data[j].entryType === "article") {

                        if (data[j].entryTags['volume'] !== undefined) {

                            article_details = data[j].entryTags['volume'];
                            first = false;
                        }

                        if (data[j].entryTags['number'] !== undefined) {

                            article_details = data[j].entryTags['volume'] + "(" + data[j].entryTags['number'] + ")";
                            first = false;

                        }

                        if (data[j].entryTags['pages'] !== undefined) {

                            article_details = first ? "" : article_details += ":";
                            article_details += data[j].entryTags['pages'];
                            first = false;
                        }

                        details = article_details;
                        //console.log( "article_details: " + article_details );

                        //conference: ['p.' PAGEFROM-PAGETO, LOCATION, PUBLISHER]    
                    } else if ((data[j].entryType === "conference")
                        || (data[j].entryType === "inproceedings")
                        || (data[j].entryType === "proceedings")) {

                        if (data[j].entryTags['pages'] !== undefined) {

                            conf_details = "p. " + data[j].entryTags['pages'];
                            first = false;

                        }

                        if (data[j].entryTags['address'] !== undefined) {

                            conf_details = !first ? conf_details += ", " : "";
                            conf_details += data[j].entryTags['address'];
                            first = false;
                        }

                        if (data[j].entryTags['publisher'] !== undefined) {

                            conf_details = first ? "" : conf_details += ", ";
                            conf_details += data[j].entryTags['publisher'];
                            first = false;
                        }
                        details = conf_details;
                        //console.log( "conf_details: " + conf_details );

                        //book: ['Edition': EDITION, PUBLISHER, ADDRESS]
                    } else if ((data[j].entryType === "book")
                        || (data[j].entryType === "booklet")) {

                        if (data[j].entryTags['edition'] !== undefined) {

                            book_details = "Edition: " + data[j].entryTags['edition'];
                            first = false;

                        }

                        if (data[j].entryTags['publisher'] !== undefined) {

                            book_details = first ? "" : book_details += ", ";
                            book_details += data[j].entryTags['publisher'];
                            first = false;
                        }

                        if (data[j].entryTags['address'] !== undefined) {

                            book_details = first ? "" : book_details += ", ";
                            book_details += data[j].entryTags['address'];
                            first = false;
                        }
                        details = book_details;
                        //console.log( "book details: " + book_details );

                    }//thesis: [TYPE, UNIVERSITY, ADDRESS]

                    else if ((data[j].entryType === "thesis")
                        || (data[j].entryType === "mastersthesis")
                        || (data[j].entryType === "phdthesis")) {

                        thesis_type = (data[j].entryType) === "thesis" ? "Students" : (data[j].entryType === "mastersthesis") ? "Master's thesis" : (data[j].entryType === "phdthesis") ? "Ph.D. thesis" : undefined;
                        //console.log( "thesis_type: " + thesis_type );

                        if (thesis_type !== undefined) {
                            thesis_details = thesis_type;
                            first = false;
                        }

                        if (data[j].entryTags['school'] !== undefined) {

                            first ? "" : thesis_details += ", ";
                            thesis_details += data[j].entryTags['school'];
                            first = false;
                        }

                        if (data[j].entryTags['address'] !== undefined) {

                            first ? "" : thesis_details += ", ";
                            thesis_details += data[j].entryTags['address'] + ", ";
                            first = false;
                        }
                        details = thesis_details;
                        //console.log( "thesis_details: " + thesis_details ); 
                    }

                    //depending if abstract is availabel an arrow will be added
                    if (data[j].entryTags['abstract'] != undefined || details !== "") {
                        arrow = "<svg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='22px' height='22px' viewBox='0 0 22 22' enable-background='new 0 0 22 22' xml:space='preserve' class='download'><g transform='rotate(-90, 11, 11)')><path fill='#333333' d='M11.31,5.236l-4.161,8.315l-4.16-8.315H11.31z'/></g></svg>";
                    } else {
                        arrow = "&nbsp";
                    }

                    var cover = "<a target='_blank' style='float: right;' href='" + data[j].entryTags['url'] + "'><img class='cover' src='" + covers + "/" + data[j]['citationKey'] + ".png' alt='" + data[j]['citationKey'] + "'/></a>"
                    var thumb = "<img class='thumb' src='" + thumbs + "/" + data[j]['citationKey'] + ".jpg' alt='" + data[j]['citationKey'] + "'/>"

                    //check the type and according to the type, add different information
                    var entryType = data[j].entryType.toLowerCase();
                    if (entryType === "article") { type = "Journal Article" }
                    else if ((entryType === "conference") || (entryType === "inproceedings")) { type = "Conference paper" }
                    else if (entryType === "phdthesis") { type = "PhD Thesis" }

                    //aritcle: list journal name
                    //conferene: list conference name
                    //Part of a Book: list the title
                    var headl = '';
                    var headl_prefix = "<div class='headl' style='float:left; padding: 5px 0px;'>";
                    if (thumbs) {
                        headl_prefix += "<div class='thumb'>" + thumb + "</div>";
                    } else {
                        headl_prefix += "<div class='arrow'>" + arrow + "</div>";
                    }
                    headl_prefix += "<div class='subheadl'><h3>";
                    var headl_suffix = "</h3></div>";
                    if (covers && entryType !== "artwork" && entryType !== "software" && entryType !== "unpublished" && data[j].entryTags['url'] !== undefined) {
                        headl_suffix += "<div class='cover'>" + cover + "</div>";
                    } else {
                        headl_suffix += "<div class='url'>" + url + "</div>";
                    }
                    headl_suffix += "</div>";
                    headl = author + "<br>" + title;
                    headl += "<br>";
                    //headl += data[j].entryTags['year'];
                    if (data[j].entryTags['publisher'] !== undefined) {
                        headl += data[j].entryTags['publisher'] + " ";
                    }
                    if (data[j].entryTags['series'] !== undefined) {
                        headl += data[j].entryTags['series'] + " ";
                    }

                    if ((data[j].entryType === "article")
                        && (data[j].entryTags['journaltitle'] !== undefined)) {

                        //Additional data in header
                        journal = "(" + data[j].entryTags['journaltitle'] + ")";
                        headl += journal;

                    } else if ((data[j].entryType === "conference")
                        || (data[j].entryType === "inproceedings")
                        || (data[j].entryType === "inbook")
                        || (data[j].entryType === "incollection")
                        && (data[j].entryTags['booktitle'] !== undefined)) {

                        headl += "(" + data[j].entryTags['booktitle'] + ")";
                    } else if ((data[j].entryType === "report")
                        || (data[j].entryType === "techreport")) {
                        var first = true;
                        if (data[j].entryTags['institution'] !== undefined) {
                            first ? "" : headl += " ";
                            headl += data[j].entryTags['institution'];
                            first = false;
                        }
                        if (data[j].entryTags['number'] !== undefined) {
                            first ? "" : headl += " ";
                            headl += data[j].entryTags['number'];
                            first = false;
                        }

                    } else if ((data[j].entryType === "thesis")) {
                        var first = true;
                        if (data[j].entryTags['type'] !== undefined) {
                            var thesisType = data[j].entryTags['type']
                            if (thesisType === "phdthesis") { thesisType = "PhD" }
                            headl += thesisType + " ";
                            first = false;
                        }

                        if (data[j].entryTags['year'] !== undefined) {
                            headl += data[j].entryTags['year'] + " ";
                            first = false;
                        }

                        headl += "(";
                        if (data[j].entryTags['institution'] !== undefined) {
                            //first ? "" : headl += ", ";
                            headl += data[j].entryTags['institution'];
                            first = false;
                        }
                        if (data[j].entryTags['address'] !== undefined) {
                            first ? "" : headl += ", ";
                            headl += data[j].entryTags['address'];
                            first = false;
                        }
                        headl += ")";
                        type = "Thesis";
                    } else if ((data[j].entryType === "unpublished")) {
                        if (data[j].entryTags['eventtitle'] !== undefined) {
                            // first ? "" : headl += ", ";
                            // headl += "(";
                            headl += data[j].entryTags['eventtitle'];
                            // headl += ")";
                            // first = false;
                        }
                    }
                    headl += " ";
                    if ((data[j].entryType === "unpublished")) {
                        //headl += "Presentations"
                    }
                    else {
                        headl += type;
                    }

                    $(".accordion").append(headl_prefix + headl + headl_suffix);

                    var pane = "<div class='pane'>"
                    // pane += "<div class='subpane' style='width: 75%;'>";
                    pane += "<div class='subpane' style='width: 100%;'>";

                    //check if details and/or abstract exists and append them to the foldng div
                    if ((data[j].entryTags['abstract'] !== undefined)
                        && (details !== "")) {

                        //(details !== "") ? "" : thesis_details += "<br>&nbsp";
                        abs = data[j].entryTags['abstract'];
                        // pane += "<p>" + details + "</p>" + "<br>&nbsp";
                        pane += "<p>" + abs + "</p>"
                        // pane += "</div>"
                        // pane += "<div class='subpane' style='width: 15%;'><span style='font-style: italic; color: #898989; font-weight:bold;'>Notes:<br></span>" + notes;


                    } else if ((data[j].entryTags['abstract'] === undefined)
                        && (details !== "")) {
                        // pane += "<p>" + details + "</p>"
                        // pane += "</div>"
                        // pane += "<div class='subpane' style='width: 15%;'><span style='font-style: italic; color: #898989; font-weight:bold;'>Notes:<br></span>" + notes;

                    } else if ((data[j].entryTags['abstract'] !== undefined)
                        && (details === "")) {

                        abs = data[j].entryTags['abstract'];
                        pane += "<p>" + abs + "</p>"
                        // pane += "</div>"
                        // pane += "<div class='subpane' style='width: 15%;'><span style='font-style: italic; color: #898989; font-weight:bold;'>Notes:<br></span>" + notes;
                    }
                    pane += "</div>";
                    pane += "</div>";
                    $(".accordion").append(pane);

                }
                var key, count = 0;

                for (key in data) {
                    if (data.hasOwnProperty(key)) {
                        count++;
                    }
                }

                function cap(string) {
                    return string.charAt(0).toUpperCase() + string.slice(1);
                }

                if (sortBy == 0) {

                    for (var j = 0; j < count; j++) {
                        subgenerate();
                    }

                } else if (sortBy == 1) {

                    var yeararr = new Array();;

                    for (var n = 0; n < count; n++) {

                        yeararr.push(data[n].entryTags['year']);

                    }
                    var uniqueYear = [];
                    $.each(yeararr, function (i, el) {
                        if ($.inArray(el, uniqueYear) === -1) uniqueYear.push(el);
                    });
                    uniqueYear.sort(function (a, b) {
                        return b - a
                    });
                    //console.log(uniqueYear);

                    for (i = 0; i < uniqueYear.length; i++) {

                        $(".accordion").append("<h1>" + uniqueYear[i] + "</h1>");
                        for (var j = 0; j < count; j++) {

                            if (uniqueYear[i] == data[j].entryTags['year']) {
                                subgenerate();
                            }
                        }
                    }
                } else if (sortBy == 2) {
                    var typearr = new Array();
                    for (var n = 0; n < count; n++) {
                        typearr.push(data[n].entryType);
                    }
                    //var TypeArray = ["article", "book", "conference", "miscellaneous", "part of book", "unpublished", "report", "thesis"];
                    var TypeArray = ["conference", "article", "thesis", "report", "presentation", "software", "artwork"]; //["Conferencess", "Journal Articles", "Thesis", "Reports", "Presentations", "Software", "Artworks"];
                    for (i = 0; i < TypeArray.length; i++) {
                        $(".accordion").append("<h1>" + cap(TypeArray[i]) + "</h1>");
                        for (var j = 0; j < count; j++) {
                            var entry = data[j].entryType;
                            if (TypeArray[i] == entry) {
                                subgenerate();
                            } else if ((TypeArray[i] == "book") && ((entry == "booklet"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "conference") && ((entry == "inproceedings") || (entry == "proceedings"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "part of book") && ((entry == "inbook") || (entry == "incollection"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "presentation") && ((entry == "unpublished"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "report") && ((entry == "manual") || (entry == "techreport"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "software") && ((entry == "software"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "artwork") && ((entry == "artwork"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "thesis") && ((entry == "mastersthesis") || (entry == "phdthesis"))) {
                                subgenerate();
                            } else if ((TypeArray[i] == "miscellaneous") && (entry != "article") && (entry != "book") && (entry != "conference") && (entry != "part of book") && (entry != "report") && (entry != "thesis") && ((entry != "booklet") && (entry != "buch")) && ((entry != "inproceedings") && (entry != "proceedings")) && ((entry != "inbook") && (entry != "incollection")) && ((entry != "manual") && (entry != "techreport")) && ((entry != "mastersthesis") && (entry != "phdthesis"))) {
                                subgenerate();
                            }
                        }
                    }
                }
                //  Accordion Panels
                $(".accordion .pane").show();
                $('.accordion .pane').css("border-left", "3px solid " + selection_color);
                //setTimeout("$('.accordion .pane').slideToggle('slow');", 1);
                $('.accordion .pane').slideToggle('slow');
                $(".accordion .headl").click(function () {
                    $(this).next(".pane").slideToggle("slow").siblings(".pane:visible").slideUp("slow");
                    $(this).next(".pane").css("border-left", "3px solid " + selection_color);
                    $(".subpane").css({ "display": "block" });

                    var g = d3.select(this).select("g");
                    if (!g.empty()) {
                        if (g.classed("open")) {
                            g.classed("open", false);
                            g.attr("transform", "rotate(-90, 11, 11)");
                        } else {
                            g.classed("open", true);
                            g.attr("transform", "rotate(0, 11, 11)");
                        }
                    }
                });

            }
        }

        //****************************FOOTER*******************************//

        var FOOTER = function () {

            //append a div with text
            var footer = $('#footer');

            footer.append("<p> PubViz is an Open Source Project and can be downloaded from <a href='https://github.com/fhstp/PubViz/' target='_blank'>GitHub</a>. More information about the tool and its installation can be found on the <a href='http://pubviz.fhstp.ac.at/#download/' target='_blank'>PubViz website.</a></p>");

            //set the same margin-left as the svg do - comment in if footer is left-aligned, comment out is footer is centered
            //offset = $( "#pubVis" ).offset();
            //$( "#footer" ).css("margin-left", offset.left);
        }

        //*****************************MAIN**************************//


        calculate_width();

        //build html structure
        setup_layout();

        //display the view
        display_all_views();
        //console.log("document.body.scrollHeight: " + document.body.scrollHeight);

        update_window();
        //console.log( "parseInt(d3.select('#pubVis')...?: " + parseInt(d3.select('#pubVis').attr('width')) );


        //hide the loading-div after successfully loaded
        onReady(function () {
            //show('loading', false);
            $(".target").show();
        });

        //****************************ACTION**************************//

        $("svg").click(function (event) {

            //console.log( "selected_items" );
            //console.dir( selected_items );

            //actions if sth was selected or the time period changed
            if (selected_items_changed || timeline_changed) {
                //console.log( "selected_items_changed || timeline_changed" );

                clearAll_pushed = false;

                filtered_json = create_filtered_json({ filter_criteria: selected_items }).entries;

                //highlight_selection_items();

                update_views({ changed_data: filtered_json });

                highlight_selection_items();

                selected_items_changed = false;
                timeline_changed = false;


            } else {

                clearAll_pushed = true;
                selected_items = { years: [], types: [], keywords: [], authors: [] };

                remove_highlight_selection_items_years();
                remove_highlight_selection_items_types();
                remove_highlight_selection_items_keywords();
                remove_highlight_selection_items_authors();

                update_views({ changed_data: empty });
            }

        });
    }


    //@param.errors = list with entries that were not able to parst into a json
    var prepare_errors = function (errors) {
        var text;
        //console.dir ( errors ); 
        //console.log("errors.errorEntry.length: " + errors.errorEntry.length);

        if (errors.errorEntry.length > 0) {
            text = "<h1>DATA ERROR! </br></br><p>The following " + errors.errorEntry.length + " listed entries of the file '" + filename + "' cannot be parsed correctly and won't be shown in the visalization.  </p></br><p> Please correct the syntax in the '" + filename + "' and reload the page if you would like those entries to appear.</h1></p></br>";

            for (var i = 0; i < errors.errorEntry.length; i++) {

                text += errors.errorEntry[i] + "</br>" + "</br>";
            }
        } else {
            text = ""
        }

        //console.log( "text:" + text ); 
        //alert( text );
        return { error_text: text };
    }

    return { make_it_all: make_it_all };
}();




/* An extension function splits string with substring or RegEx and the delimiter is putted according to second parameter ahead or behind.
found at: http://stackoverflow.com/questions/12001953/javascript-and-regex-split-string-and-keep-the-separator
*/

String.prototype.splitKeep = function (splitter, ahead) {
    var self = this;
    var result = [];
    if (splitter != '') {
        var matches = [];
        // Getting mached value and its index
        var replaceName = splitter instanceof RegExp ? "replace" : "replaceAll";
        var r = self[replaceName](splitter, function (m, i, e) {
            matches.push({ value: m, index: i });
            return getSubst(m);
        });
        // Finds split substrings
        var lastIndex = 0;
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            var nextIndex = ahead == true ? m.index : m.index + m.value.length;
            if (nextIndex != lastIndex) {
                var part = self.substring(lastIndex, nextIndex);
                result.push(part);
                lastIndex = nextIndex;
            }
        };
        if (lastIndex < self.length) {
            var part = self.substring(lastIndex, self.length);
            result.push(part);
        };
    }
    else {
        result.add(self);
    };
    return result;

    // Substitution of matched string
    function getSubst(value) {
        var substChar = value[0] == '0' ? '1' : '0';
        var subst = '';
        for (var i = 0; i < value.length; i++) {
            subst += substChar;
        }
        return subst;
    };
};


