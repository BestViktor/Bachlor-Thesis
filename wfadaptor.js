/*
  This file is part of cpee-layout.

  cpee-layout is free software: you can redistribute it and/or modify it under
  the terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.

  cpee-layout is distributed in the hope that it will be useful, but WITHOUT
  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
  FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
  details.

  You should have received a copy of the GNU General Public License along with
  cpee-layout (file COPYING in the main directory). If not, see
  <http://www.gnu.org/licenses/>.
*/

// TODO: changes in svg-script:
// 1) drawing functions
// 2) creation of svg-container (Bug: arrows on lines)
// 3) after-function to insert using namespace of description

// WfAdaptor:
// Handles interaction between Illustartor and Description
// e.g. Event fires to Adaptor to insert Element and Illustrator and Description do it

/**
 *
 * @param {*} text
 * @param {*} charWidthMap
 * @returns
 */
function update_tile_size(group, className = "tile") {
    const boxes = Array.from(group.children()).map(el => {
        try { return el.getBBox(); } catch { return null; }
    }).filter(b => b && b.width > 0 && b.height > 0);

    if (!boxes.length) return;
    const minX = Math.min(...boxes.map(b => b.x));
    const minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.width));
    const maxY = Math.max(...boxes.map(b => b.y + b.height));

    const padding = 5;
    const rect = $(group[0].querySelector(`rect.${className}`));
    rect.attr({
        x: minX,
        y: minY,
        width: maxX - minX + padding,
        height: maxY - minY + padding
    });
}

function updateClipPath(svgEl, newWidth) {
    const newClipId = `clip-${Date.now()}`;
    const clipPath = svgEl.querySelector("#myClip");
    const clipRect = svgEl.querySelector("#myClip rect");
    const gElement = svgEl.querySelector("g");
    if (clipPath && clipRect && gElement) {
        clipRect.setAttribute("width", newWidth + 5);
        svgEl.querySelector("#mainRect").setAttribute("width",newWidth + 8)
        clipRect.setAttribute("x", 1);
        clipPath.setAttribute("id", newClipId);
        gElement.setAttribute("clip-path", `url(#${newClipId})`);
    }
}

function updatePosCol(children, block, labels, pos,max) {
    for (let child of children) {
        let width = 0
        let className = child.getAttribute('class');
        let elementid = child.getAttribute('element-id');
        if (className !== 'group') {
            let result = labels.find(item => item.element_id === elementid);
            if (result !== undefined) {
                let elementlabel = result.label[0].value;
                width = (estimateTextWidth(elementlabel) / 40) + 0.5;
                pos.col = block.max.col + width
            }
            if (pos.col > max.col) {
                max.col = pos.col
            }
        } else {
            updatePosCol(child.childNodes, block, labels, pos,max);
        }
    }
}

function estimateTextWidth(
    text,
    charWidthMap = {
        default: 5, // 默认宽度 / Default width
        uppercase: 8.5, // 大写字母宽度 / Width for uppercase letters
        lowercase: 7, // 小写字母宽度 / Width for lowercase letters
        digit: 6, // 数字宽度 / Width for digits
        symbol: 6, // 特殊字符宽度 / Width for special characters
        narrow: 3, // 窄字符宽度，如 i, I, 1 / Width for narrow characters, e.g., i, I, 1
    }
) {
    if (!text) return 0;
    const narrowChars = new Set([
        "i", "I", "l", "f", "t", " ",
        "!", "|", "'", "\"", ":", ";", ".", "\\", "/", "(", ")", "[", "]", "{", "}"]);

    return Array.from(text).reduce((width, char) => {
        if (narrowChars.has(char)) {
            // 特殊处理窄字符 / Special handling for narrow characters
            return width + (charWidthMap.narrow || charWidthMap.default);
        } else if (/[A-Z]/.test(char)) {
            // 大写字母 / Uppercase letters
            return width + (charWidthMap.uppercase || charWidthMap.default);
        } else if (/[a-z]/.test(char)) {
            // 小写字母 /  Lowercase letters
            return width + (charWidthMap.lowercase || charWidthMap.default);
        } else if (/[0-9]/.test(char)) {
            // 数字/ Numbers
            return width + (charWidthMap.digit || charWidthMap.default);
        } else {
            // 特殊字符 / Special characters
            return width + (charWidthMap.symbol || charWidthMap.default);
        }
    }, 0);
}

function wrapText(textElement, text, maxWidth, lineHeight, fontSize, scaleFactor = 1, newWidth) {
    // 清空 textElement，避免重复内容 / Clear textElement to avoid duplicate content
    while (textElement.firstChild) {
        textElement.removeChild(textElement.firstChild);
    }

    // 拆分文本 / Split the text into words
    const words = text.trim().split(/\s+/);

    let lines = ["", ""]; // 初始化两行 / Initialize two lines
    let currentLine = 0; // 0 表示第一行，1 表示第二行 / 0 for first line, 1 for second line
    let isTruncated = false; // 标记是否需要省略号 / Flag to indicate if ellipsis is needed
    let firstLineFull = false; // 标记第一行是否已满 / Flag to mark if the first line is full

    // 如果文本只有一个单词，确保它居中 / If the text has only one word, center it
    if (words.length === 1) {
        let tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        let textWidth = estimateTextWidth(text) * (fontSize / 10) * scaleFactor;
        tspan.setAttribute("x", 0); // 左对齐，从 (0,0) 开始 / Left-align, start from (0,0)
        tspan.setAttribute("y", 6);
        tspan.textContent = text;
        textElement.appendChild(tspan);
        return textElement;
    }

    // 逐词添加到行中 / Loop through each word and add to lines
    words.forEach((word, index) => {
        let testLine = lines[currentLine] ? lines[currentLine] + " " + word : word;
        let textWidth = estimateTextWidth(testLine) * (fontSize / 10) * scaleFactor;

        if (currentLine === 1 && textWidth > maxWidth) {
            // 第二行超出，添加省略号 / Second line exceeds maxWidth, add ellipsis
            lines[1] = lines[1].trim() + " ...";
            isTruncated = true;
            return;
        }

        if (textWidth > maxWidth) {
            if (currentLine === 0 && !firstLineFull) {
                // 第一行满了，换到第二行 / First line full, move to second line
                firstLineFull = true;
                currentLine = 1;
            } else {
                // 第二行也超出，添加省略号 / Second line exceeds, add ellipsis
                lines[1] = lines[1].trim() + " ...";
                isTruncated = true;
                return;
            }
        }

        // 添加词到当前行 / Add word to current line
        if (firstLineFull && currentLine === 1) {
            lines[currentLine] += (lines[currentLine] ? " " : "") + word;
        } else {
            lines[currentLine] = testLine;
        }
    });

    // 如果只有一行被使用，平均分成两行显示 / If only one line is used, split into two lines
    if (!lines[1] && !isTruncated) {
        let splitIndex = Math.floor(words.length / 2);
        lines[0] = words.slice(0, splitIndex).join(" ");
        lines[1] = words.slice(splitIndex).join(" ");
    }

    // 计算每一行的宽度 / Calculate width of each line
    const lineWidths = lines.map(line =>
        estimateTextWidth(line) * (fontSize / 10) * scaleFactor
    );
    const maxLineWidth = Math.max(...lineWidths); // 最大行宽 / Maximum line width

    // 每一行创建 <tspan> / Create <tspan> for each line
    lines.forEach((lineText, index) => {
        let tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");

        // 计算偏移，实现行内居中 / Calculate offset to horizontally center the line
        const currentLineWidth = lineWidths[index];
        const offsetX = (maxLineWidth - currentLineWidth) / 2;

        tspan.setAttribute("x", offsetX); // 设置 x 坐标 / Set x to offsetX for centering
        if (index === 0) {
            tspan.setAttribute("y", 0); // 第一行设置 y / Set y for the first line
        } else {
            tspan.setAttribute("dy", 12); // 第二行下移 / Move second line downward
        }
        tspan.textContent = lineText.trim(); // 设置文本内容 / Set the trimmed line text
        textElement.appendChild(tspan); // 添加到 SVG / Append to SVG text element
    });
    return textElement
}



function WfAdaptor(theme_base, doit) { // Controller {{{
    // public variables {{{
    this.illustrator;
    this.description;
    this.elements = {};
    this.theme_base = theme_base;
    this.theme_dir = theme_base.replace(/theme.js/, '');
    // }}}

    // private variables {{{
    var illustrator;
    var description;
    var self = this;
    // }}}

    // helper funtions
    this.set_description = function (desc, auto_update) { // public {{{
        this.description.set_description(desc, auto_update);
    } // }}}

    this.get_description = function () { // public {{{
        return description.get_description();
    } // }}}
    this.notify = function () { // public {{{
    } // }}}
    this.draw_labels = function (max, labels, height_shift, striped) { // public {{{
    } // }}}
    this.set_svg_container = function (container) { // {{{
        illustrator.set_svg_container(container); // TODO: shadowing the container element
    } // }}}
    this.set_label_container = function (container) { // {{{
        illustrator.set_label_container(container);
    } // }}}

    // initialize
    this.illustrator = illustrator = new WfIllustrator(this);
    this.description = description = new WfDescription(this, this.illustrator);

    this.update = function (doit) {
        doit(self);
    };

    $.getScript(theme_base, function () {
        manifestation = new WFAdaptorManifestation(self);
        illustrator.compact = manifestation.compact == true ? true : false;
        illustrator.striped = manifestation.striped == true ? true : false;
        description.source = manifestation.source;
        var deferreds = [];
        // copy parent stuff
        for (element in manifestation.elements) {
            if (manifestation.elements[element].parent) {
                if (!manifestation.elements[element].description) {
                    manifestation.elements[element].description = manifestation.elements[manifestation.elements[element].parent].description;
                }
                if (!manifestation.elements[element].adaptor) {
                    manifestation.elements[element].adaptor = manifestation.elements[manifestation.elements[element].parent].adaptor;
                }
                var ill = manifestation.elements[manifestation.elements[element].parent].illustrator;
                for (var key in ill) {
                    if (manifestation.elements[element].illustrator[key] == undefined) {
                        manifestation.elements[element].illustrator[key] = ill[key];
                    }
                }
                if (manifestation.elements[element].type == undefined) {
                    manifestation.elements[element].type = manifestation.elements[manifestation.elements[element].parent].type;
                }
            }
        }
        // doit
        for (element in manifestation.resources) {
            deferreds.push(
                $.ajax({
                    type: "GET",
                    dataType: "xml",
                    url: manifestation.resources[element],
                    context: element,
                    success: function (res) {
                        manifestation.resources[this] = $(res.documentElement);
                    }
                })
            );
        }
        for (element in manifestation.elements) {
            if (manifestation.elements[element].illustrator) {
                var types = ["svg", "midsvg", "endsvg"];
                for (var i = 0; i < types.length; i++) {
                    var type = types[i];
                    if (manifestation.elements[element].illustrator[type]) {
                        deferreds.push(
                            $.ajax({
                                type: "GET",
                                dataType: "xml",
                                url: manifestation.elements[element].illustrator[type],
                                context: {element: element, type: type},
                                success: function (res) {
                                    manifestation.elements[this.element].illustrator[this.type] = $(res.documentElement);
                                }
                            })
                        );
                    }
                }
                illustrator.elements[element] = manifestation.elements[element].illustrator;
                illustrator.elements[element].type = manifestation.elements[element].type || 'abstract';
            }
            if (manifestation.elements[element].description) {
                if (typeof manifestation.elements[element].description === 'string') {
                    manifestation.elements[element].description = [manifestation.elements[element].description];
                }
                if ($.isArray(manifestation.elements[element].description)) {
                    for (const [ind, val] of Object.entries(manifestation.elements[element].description)) {
                        deferreds.push(
                            $.ajax({
                                type: "GET",
                                dataType: "xml",
                                url: val,
                                context: element,
                                success: function (res) {
                                    manifestation.elements[this].description = $(res.documentElement);
                                    description.elements[this] = manifestation.elements[this].description;
                                }
                            })
                        );
                    }
                    ;
                }
            }
            if (manifestation.elements[element].adaptor) {
                self.elements[element] = manifestation.elements[element].adaptor;
            }
        }
        $.when.apply($, deferreds).then(function (x) {
            doit(self);
        });
    });
} // }}}

// WfIllustrator:
// Is in charge of displaying the Graph. It is further able insert and remove elements with given ID's from the illsutration.
function WfIllustrator(wf_adaptor) { // View  {{{
    // Variable {{{
    // public
    this.moveOffset = 0;
    this.height = 40;
    this.width = 40;
    this.height_shift = this.height * 0.26;
    this.width_shift = this.width * 0.39;
    this.elements = {}; // the svgs
    this.svg = {};
    this.draw = {};
    this.compact = true;
    this.striped = true;
    // private
    var self = this;
    var adaptor = null;
    // }}}
    // Generic Functions {{{
    this.set_label_container = function (con) { // {{{
        self.svg.label_container = con;
    } // }}}
    this.set_svg_container = function (con) { // {{{
        self.svg.container = con;
        self.svg.container.append($X('<defs xmlns="http://www.w3.org/2000/svg">' +
            '  <marker id="arrow" viewBox="0 0 10 10" refX="33" refY="5" orient="auto" markerUnits="strokeWidth" markerWidth="4.5" makerHeight="4.5">' +
            '    <path d="m 2 2 l 6 3 l -6 3 z"/>' +
            '  </marker>' +
            '</defs>'));
        self.svg.defs = {};
        self.svg.defs['unknown'] = $X('<g xmlns="http://www.w3.org/2000/svg" class="unknown">' +
            '<circle cx="15" cy="15" r="14" class="unkown"/>' +
            '<text transform="translate(15,20)" class="normal">?</text>' +
            '</g>');
        for (element in self.elements) {
            if (self.elements[element].svg) {
                var sym = $X('<g xmlns="http://www.w3.org/2000/svg"/>').append(self.elements[element].svg.clone().children()); // append all children to symbol
                $.each(self.elements[element].svg.attr('class').split(/\s+/), function (index, item) {
                    sym.addClass(item);
                }); // copy all classes from the root node
                self.svg.defs[element] = sym;
            }
            if (self.elements[element].midsvg) {
                var sym = $X('<g xmlns="http://www.w3.org/2000/svg"/>').append(self.elements[element].midsvg.clone().children()); // append all children to symbol
                $.each(self.elements[element].svg.attr('class').split(/\s+/), function (index, item) {
                    sym.addClass(item);
                }); // copy all classes from the root node
                self.svg.defs[element].midsvg = sym;
            }
            if (self.elements[element].endsvg) {
                var sym = $X('<g xmlns="http://www.w3.org/2000/svg"/>').append(self.elements[element].endsvg.clone().children()); // append all children to symbol
                $.each(self.elements[element].svg.attr('class').split(/\s+/), function (index, item) {
                    sym.addClass(item);
                }); // copy all classes from the root node
                self.svg.defs[element].endsvg = sym;
            }
        }

    } // }}}
    var clear = this.clear = function () { // {{{
        $('> :not(defs)', self.svg.container).each(function () {
            $(this).remove()
        });
    } // }}}
    this.set_svg = function (graph) { // {{{
        if (graph.max.row < 1) graph.max.row = 1;
        if (graph.max.col < 1) graph.max.col = 1;
        self.svg.container.attr('height', (graph.max.row) * self.height + self.height_shift);
        self.svg.container.attr('width', (graph.max.col + 0.55) * self.width);
        self.svg.container.attr('style', 'overflow:visible');
        self.svg.container.append(graph.svg);
    } // }}}
    this.get_node_by_svg_id = function (svg_id) { // {{{
        return $('[element-id = \'' + svg_id + '\'] g.activities', self.svg.container);
    } // }}}
    this.get_label_by_svg_id = function (svg_id) { // {{{
        return $('[element-id = \'' + svg_id + '\']', self.svg.label_container);
    } // }}}
    this.get_elements = function () { // {{{
        return $('g.element', self.svg.container);
    } // }}}
    this.get_labels = function () { // {{{
        return $('[element-id]', self.svg.label_container);
    } // }}}
    // }}}
    // Helper Functions {{{
    var get_y = this.draw.get_y = function (row) { // {{{
        return {y: row * self.height - self.height, height_shift: self.height_shift};
    } // }}}

    var draw_stripe = this.draw.draw_stripe = function (row, maxcol) { // {{{
        if (maxcol < 1) maxcol = 1;
        var g = $X('<rect element-row="' + row + '" class="stripe ' + (row % 2 == 0 ? 'even' : 'odd') + '" x="0" y="' + String(row * self.height + self.height_shift / 2) + '" width="' + (self.width * maxcol + self.width - self.width_shift) + '" height="' + (self.height) + '" xmlns="http://www.w3.org/2000/svg"></rect>');
        self.svg.container.prepend(g);
        return g;
    } // }}}

    var draw_label = this.draw.draw_label = function (tname, id, label, row, col, group) { // {{{
        if (self.elements[tname].innerLabel) return
        let width = 0// estimateTextWidth(label)
        var g = $X('<text class="label" transform="translate(' + String(col * self.width - self.width_shift + 32 + width) + ',' + String(row * self.height + 12 - (self.height - self.height_shift)) + ')" xmlns="http://www.w3.org/2000/svg"></text>');
        var spli = $(label.split(/\n/));
        spli.each(function (k, v) {
            var tspan = $X('<tspan x="0" dy="' + (spli.length > 1 ? '-7' : '0') + '" xmlns="http://www.w3.org/2000/svg"></tspan>');
            if (k == 0) {
                tspan.text(v);
            } else {
                tspan.text(v);
                tspan.attr('dy', '15');
                tspan.attr('dx', '15');
            }
            g.append(tspan);
        });
        if (group) {
            group.find('g.element[element-id=' + id + ']').append(g);
        } else {
            self.svg.container.append(g);
        }
        return g;
    } // }}}

    var draw_symbol = this.draw.draw_symbol = function (sname, id, title, row, col, group, addition) { // {{{
        var width = estimateTextWidth(title)
        if (self.elements[sname] == undefined || self.elements[sname].svg == undefined) sname = 'unknown';
        if (addition) {
            var g = $X('<g class="element" element-type="' + sname + '" element-id="' + id + '" xmlns="http://www.w3.org/2000/svg">' +
                '<g transform="translate(' + String(col * self.width - self.width_shift) + ',' + String(row * self.height - (self.height - self.height_shift)) + ')"></g>' +
                '</g>');
        } else {
            var g = $X('<g class="element" element-type="' + sname + '" element-id="' + id + '" xmlns="http://www.w3.org/2000/svg">' +
                '<g transform="translate(' + String(col * self.width - self.width_shift) + ',' + String(row * self.height - (self.height - self.height_shift)) + ')">' +
                '<text class="super" transform="translate(30,8.4)">' +
                '<tspan class="active">0</tspan>' +
                '<tspan class="colon">,</tspan>' +
                '<tspan class="vote">0</tspan>' +
                '</text>' +
                '</g>' +
                '</g>');
        }
        var sym = self.svg.defs[sname].clone();
        var tit = $X('<title xmlns="http://www.w3.org/2000/svg"></title>');
        tit.text(title);
        sym.prepend(tit);
        sym.attr('class', 'activities');
        let point;
        let path = sym[0].querySelector("g .hfill.rfill.cline.stand");
        if (path) {
            let length = path.getTotalLength();
            point = path.getPointAtLength(length);
        }
        if (self.elements[sname].innerLabel && title) {
            var text = $X('<text class="label stand" xmlns="http://www.w3.org/2000/svg" transform="translate(24,13)"></text>');
            var renderLabel = title;
            text.text(renderLabel);
            sym.prepend(text);
            wrapText(text.get(0), renderLabel, 80, 14, 10, 1, width);
            var offset_label = width / 5;
            text.attr("transform", `translate(${24 + offset_label},${13})`);
        }
        if (self.elements[sname].midsvg) {
            let svgEl = self.elements[sname].midsvg.clone();

            if (self.elements[sname].innerLabel && title) {
                updateClipPath(svgEl[0], width, point.x);
                svgEl = svgEl.children().clone();
                svgEl.attr("transform", "translate(23,0)");
            }
            sym.prepend(svgEl);
        }
        if (self.elements[sname].endsvg) {
            let endsvg = self.elements[sname].endsvg.children().clone();
            let translateX = (self.elements[sname].innerLabel && title) ? (width + point.x + 4) : point.x;
            endsvg.attr("transform", `translate(${translateX}, 0)`);
            sym.prepend(endsvg);
        }
        $(g[0].childNodes[0]).append(sym);

        // Binding events for symbol
        bind_event(g, sname, true);
        if (group) {
            group.append(g);
        } else {
            self.svg.container.children('g:first').append(g);
        }
        return g;
    } // }}}
    var bind_event = this.draw.bind_event = function (sym, tname, context) { //{{{
        for (event_name in adaptor.elements[tname]) {
            sym.bind(event_name, {'function_call': adaptor.elements[tname][event_name]}, function (e) {
                e.data.function_call($(this).attr('element-id'), e)
            });
            if (event_name == 'mousedown') sym.bind('contextmenu', false);
        }
    } //}}}
    var draw_border = this.draw.draw_border = function (id, p1, p2, group) { // {{{
        const rect = $X(`<rect class="block" rx="15" ry="15" xmlns="http://www.w3.org/2000/svg" element-id="${id}"/>`);
        group.prepend(rect);
        requestAnimationFrame(() => {
            setTimeout(() => {
                update_tile_size(group,"block");
            }, 0);
        });

    } // }}}

    var draw_tile = this.draw.draw_tile = function (id, p1, p2, group) { //
        const rect = $X(`<rect class="tile" rx="15" ry="15" xmlns="http://www.w3.org/2000/svg" element-id="${id}"/>`);
        group.prepend(rect);
        requestAnimationFrame(() => {
            setTimeout(() => {
                update_tile_size(group);
            }, 0);
        });
    } // }}}
    var draw_connection = this.draw.draw_connection = function (group, start, end, max_line, num_lines, arrow) {
        if (((end['row'] - start['row']) == 0) && ((end['col'] - start['col']) == 0)) return;
        var line;
        if (arrow)
            line = $X('<path xmlns="http://www.w3.org/2000/svg" class="ourline" marker-end="url(#arrow)"/>');
        else
            line = $X('<path xmlns="http://www.w3.org/2000/svg" class="ourline"/>');
        if (end['row'] - start['row'] == 0 || end['col'] - start['col'] == 0) { // straight line
            line.attr("d", "M " + String(start['col'] * self.width) + "," + String(start['row'] * self.height - 15) + " " +
                String(end['col'] * self.width) + "," + String(end['row'] * self.height - 14)
            );
        } else if (end['row'] - start['row'] > 0) { // downwards
            if (end['col'] - start['col'] > 0) {// left - right
                if (self.compact) {
                    line.attr("d", "M " + String(start['col'] * self.width) + "," + String(start['row'] * self.height - 15) + " " +
                        String(start['col'] * self.width + 14) + "," + String((end['row'] - 1) * self.height) + " " + // first turn of hotizontal-line going away from node
                        String(end['col'] * self.width) + "," + String((end['row'] - 1) * self.height) + " " +
                        String(end['col'] * self.width) + "," + String(end['row'] * self.height - 15)
                    );
                } else {
                    line.attr("d", "M " + String(start['col'] * self.width) + "," + String(start['row'] * self.height - 15) + " " +
                        String(end['col'] * self.width) + "," + String(start['row'] * self.height - 15) + " " +
                        String(end['col'] * self.width ) + "," + String(end['row'] * self.height - 14)
                    );
                }
            } else { // right - left
                line.attr("d", "M " + String(start['col'] * self.width ) + "," + String(start['row'] * self.height) + " " +
                    String(start['col'] * self.width ) + "," + String(end['row'] * self.height - 35) + " " +
                    String(end['col'] * self.width + 14 ) + "," + String(end['row'] * self.height - 35) + " " + // last turn of horizontal-line going into the node
                    String(end['col'] * self.width ) + "," + String(end['row'] * self.height - 15)
                );
            }
        } else if (end['row'] - start['row'] < 0) { // upwards
            if (num_lines > 1) {// ??? no idea
                line.attr("d", "M " + String(start['col'] * self.width ) + "," + String(start['row'] * self.height - 15) + " " +
                    String(start['col'] * self.width ) + "," + String((max_line - 1) * self.height + 5) + " " +
                    String(end['col'] * self.width + 20) + "," + String((max_line - 1) * self.height + 5) + " " +
                    String(end['col'] * self.width + 20) + "," + String(end['row'] * self.height) + " " +
                    String(end['col'] * self.width) + "," + String(end['row'] * self.height - 15)
                );
            } else {
                line.attr("d", "M " + String(start['col'] * self.width ) + "," + String(start['row'] * self.height - 15) + " " +
                    String(end['col'] * self.width + 15) + "," + String(start['row'] * self.height - 15) + " " +
                    String(end['col'] * self.width + 15) + "," + String(end['row'] * self.height + 15) + " " +
                    String(end['col'] * self.width) + "," + String(end['row'] * self.height - 15)
                );
            }
        }
        self.svg.container.append(line);
    } //  }}}
    // }}}
    // Initialize {{{
    adaptor = wf_adaptor;
    // }}}
} // }}}

// WfDescription:
// Manages the description. Is is further able to add/remove elements from the controlflow description.
function WfDescription(wf_adaptor, wf_illustrator) { // Model {{{
    // public variables
    this.elements = {}; // the rngs
    this.source = null;
    // private variables
    var self = this;
    var adaptor;
    var illustrator;
    var description;
    var id_counter = {};
    var update_illustrator = true;
    var labels = [];

    // Set Labels //{{{
    this.set_labels = function (graph) {
        if (illustrator.striped == true && illustrator.compact == false) {
            for (var i = 0; i < graph.max.row; i++) {
                illustrator.draw.draw_stripe(i, graph.max.col);
            }
        }
        if (illustrator.compact == false) {
            adaptor.draw_labels(graph.max, labels, illustrator.height_shift, illustrator.striped == true ? true : false);
        } else {
            adaptor.draw_labels(graph.max, [], illustrator.height_shift, false);
        }
        if (illustrator.compact == false) {
            if (labels.length > 0) {
                for (const [key, a] of Object.entries(labels)) {
                    if (a.label && a.label[0] && a.label[0].column == 'Label' && a.label[0].value) {
                        illustrator.draw.draw_label(a.tname, a.element_id, a.label[0].value, a.row, a.col, graph.svg);
                    }
                }
                ;
            }
        }
    } //}}}


    // Generic Functions {{{
    this.set_description = function (desc, auto_update) { // public {{{
        if (auto_update != undefined) update_illustrator = auto_update;
        if (typeof desc == "string") {
            description = $($.parseXML(desc));
        } else if (desc instanceof jQuery) {
            description = desc;
        } else {
            alert("WfDescription: unknown description type:\nConstructor-Name: " + desc.constructor + " / TypeOf: " + (typeof desc));
            description = null;
        }
        id_counter = {};
        labels = [];
        illustrator.clear();
        var graph = parse(description.children('description').get(0), {'row': 0, 'col': 0, final: false, wide: false});
        illustrator.set_svg(graph);
        // set labels
        self.set_labels(graph);
    } // }}}
    var gd = this.get_description = function () { //  public {{{
        var serxml = $(description.get(0).documentElement).clone(true);
        serxml.removeAttr('svg-id');
        serxml.removeAttr('svg-type');
        serxml.removeAttr('svg-subtype');
        serxml.removeAttr('svg-label');
        $('*[svg-id]', serxml).each(function () {
            $(this).removeAttr('svg-id');
        });
        $('*[svg-type]', serxml).each(function () {
            $(this).removeAttr('svg-type');
        });
        $('*[svg-subtype]', serxml).each(function () {
            $(this).removeAttr('svg-subtype');
        });
        $('*[svg-label]', serxml).each(function () {
            $(this).removeAttr('svg-label');
        });
        return serxml.serializeXML();
    } // }}}
    this.get_node_by_svg_id = function (svg_id) { // {{{
        return $('[svg-id = \'' + svg_id + '\']', description);
    } // }}}
    var context_eval = this.context_eval = function (what) { // {{{
        return eval(what);
    } // }}}
    var get_free_id = this.get_free_id = function (other) { // {{{
        var existing = new Array();
        if (other) {
            if ($(other).attr('id')) {
                existing.push($(other).attr('id'));
            }
            $(other).find("[id]").each(function (k, v) {
                existing.push($(v).attr('id'));
            });
        }
        $('*[id]', description).each(function () {
            existing.push($(this).attr('id'))
        });
        var id = 1;
        while ($.inArray('a' + id, existing) != -1) {
            id += 1;
        }
        return 'a' + id;
    } // }}}
    var refresh = this.refresh = function (doit) {
        id_counter = {};
        labels = [];
        illustrator.clear();
        var graph = parse(description.children('description').get(0), {'row': 0, 'col': 0});
        illustrator.set_svg(graph);
        // set labels
        self.set_labels(graph);
        doit(self);
    }
    var update = this.update = function (svgid) { // {{{
        id_counter = {};
        if (update_illustrator) {
            labels = [];
            illustrator.clear();
            var graph = parse(description.children('description').get(0), {'row': 0, 'col': 0});
            illustrator.set_svg(graph);
            self.set_labels(graph);
        }

        var newn = $('*[new=true]', description);
        newn.removeAttr('new');

        if (newn.attr('svg-id') != undefined)
            adaptor.notify(newn.attr('svg-id'));
        else if (svgid != undefined)
            adaptor.notify(svgid);
        else if (newn.parent('[svg-id]').length > 0)
            adaptor.notify(newn.parent('[svg-id]').attr('svg-id'));
        else
            console.info('Something went horribly wrong');
    } // }}}
    // }}}
    // Adaption functions {{{
    this.insert_after = function (new_node, target, source_opts) { // {{{
        if ($.isArray(new_node)) {
            $.each(new_node, function (k, v) {
                var nn = self.source(v, source_opts);
                target.after(nn);
                nn.attr('new', 'true');
            });
        } else {
            var nn = self.source(new_node, source_opts);
            target.after(nn);
            nn.attr('new', 'true');
        }
        update();
    } // }}}
    this.insert_first_into = function (new_node, target, source_opts) { // {{{
        if ($.isArray(new_node)) {
            $.each(new_node, function (k, v) {
                var nn = self.source(v, source_opts);
                target.prepend(nn);
                nn.attr('new', 'true');
            });
        } else {
            var nn = self.source(new_node, source_opts);
            target.prepend(nn);
            nn.attr('new', 'true');
        }
        update();
    } // }}}
    this.insert_last_into = function (new_node, target) { // {{{
        if ($.isArray(new_node)) {
            $.each(new_node, function (k, v) {
                var nn = self.source(v);
                target.append(nn);
                nn.attr('new', 'true');
            });
        } else {
            var nn = self.source(new_node);
            target.append(nn);
            nn.attr('new', 'true');
        }
        update();
    } // }}}
    this.remove = function (selector, target) {//{{{
        var svgid;
        if (selector == undefined) {
            svgid = target.attr('svg-id');
            target.remove()
        } else {
            svgid = $(selector, target).attr('svg-id');
            if (!svgid) {
                svgid = target.attr('svg-id');
            }
            $(selector, target).remove();
        }
        update(svgid);
    }
    // }}}
    // }}}
    // Helper Functions {{{
    var parse = function (root, parent_pos) {
        // private {{{

        var pos = jQuery.extend(true, {}, parent_pos);
        var max = {'row': 0, 'col': 0};
        var prev = [parent_pos]; // connects parent with child(s), depending on the expansion
        var endnodes = [];
        var sname = sym_name(root.tagName, root);
        var root_expansion = illustrator.elements[root.tagName].expansion(root);
        var block = {'max': {}}; // e.g. {'max':{'row':0,'col':0}, 'endpoints':[]};

        var group = $X('<g class="group" xmlns="http://www.w3.org/2000/svg"/>');

        if (root_expansion == 'horizontal') pos.row++;
        if (illustrator.elements[root.tagName].col_shift(root) == true && root_expansion != 'horizontal') pos.col++;
        //if (sname === 'parallel_start') pos.col = pos.col
        if (root.tagName == 'description') { // First parsing {{{
            pos.row++;
            $(root).attr('svg-id', 'description');
            $(root).attr('svg-type', 'description');
            $(root).attr('svg-subtype', 'description');
            group.attr('element-id', 'group-description');
            if (illustrator.elements[sname].label) {
                // javascript object spread syntax is my new weird crush - the JS designers must be serious people
                labels.push({
                    ...{
                        row: pos.row,
                        col: pos.col,
                        element_id: 'start',
                        tname: 'start',
                        label: illustrator.elements[sname].label(root)
                    }, ...illustrator.draw.get_y(pos.row)
                });
            }
            illustrator.draw.draw_symbol(sname, 'description', 'START', pos.row, pos.col, group);
        } // }}}

        $(root).children().filter(function () {
            return this.localName[0] != '_';
        }).each(function () {
            var context = this;
            var tname = context.tagName;
            var sname = sym_name(tname, context);
            pos.final = illustrator.elements[sname].final ? true : false;
            pos.wide = illustrator.elements[sname].wide ? true : false;

            // Calculate next position {{{
            if (root_expansion == 'vertical') {
                pos.row++;
                //pos.labelText = "";
            }
            if (root_expansion == 'horizontal') {
                pos.col++;
                if (!illustrator.compact) {
                    if (block.max.row) {
                        pos.row = block.max.row + 1;
                    }
                }
            }


            if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'complex') {
                if (illustrator.elements[tname] != undefined && !illustrator.elements[tname].svg) pos.row++; // test 这个illustrator 是不是undefined AND 他不含有svg
                // TODO: Remaining problem is the order inside the svg. Thats why the connection is above the icon
                block = parse(context, jQuery.extend(true, {}, pos));
                group.append(block.svg);
                block.svg.attr('id', 'group-' + $(context).attr('svg-id'));
                if (illustrator.elements[sname].endnodes == 'aggregate') {
                    endnodes = [];
                } // resets endpoints e.g. potential preceding primitive
            } else {
                if (illustrator.elements[tname] != undefined && illustrator.elements[tname].type == 'primitive' && illustrator.elements[tname].svg) { // This enables "invisble" elements, by returning undefined in the SVG function (e.g. constraints)
                    block.max.row = pos.row;
                    block.max.col = pos.col; //add
                    block.endnodes = [pos];
                    block.svg = group;
                }//  如果解析到最后我们能得到一个 它自己这个block的最大的col 和 row都是自己的，and 目前还没有进行移动所以pos也赋值了，block的svg就是这个group
            }
            // }}}


            var g;
            set_details(tname, sname, pos, context); // 设置更详细的详细，例如id ，它的label 以及label的位置
            var origpos = jQuery.extend(true, {}, pos);
            [g, endnodes] = draw_position(tname, origpos, prev, block, group, endnodes, context); // g 是前置节点,但是 endnodes 是一个坐标位置
            // Prepare next iteration {{{
            if (root_expansion == 'vertical') {
                prev = jQuery.extend(true, {}, endnodes);
                pos.row = block.max.row;
            } // covers e.g. input's for alternative, parallel_branch, ... everything with horizontal expansion
            if (root_expansion == 'horizontal') {
                let children = block.svg.children()
                updatePosCol(children, block, labels, pos,max);
            }
            if (max.row < block.max.row) max.row = block.max.row;
            if (max.col < block.max.col) max.col = block.max.col;
            // }}}

            if (illustrator.elements[sname].closing_symbol) {
                var ctname = illustrator.elements[sname].closing_symbol;
                var csname = sym_name(ctname, context);
                pos.row++;
                max.row++;
                block.max.row = pos.row;
              //  console.log( block.max.col,max.col,pos.col)
                if (illustrator.elements[sname].endnodes == 'this') {
                    pos.col++;
                    if (pos.col > max.col) {
                        max.col++;
                        block.max.col = pos.col;
                    }
                    draw_position(ctname, pos, block.endnodes, block, group, [], context, {svg: g, pos: origpos});
                    pos.col--;
                    console.log( block.max.col,max.col,pos.col)
                } else {
                    [undefined, endnodes] = draw_position(ctname, pos, prev, block, group, [], context, {
                        svg: g,
                        pos: origpos
                    });
                    console.log( block.max.col,max.col,pos.col)
                }

                set_details(ctname, csname, pos, context, true);
                prev = jQuery.extend(true, {}, endnodes);
            }
        });

        if ($(root).children().filter(function () {
            return this.attributes['svg-id'] != undefined;
        }).length == 0) { // empty complex found
            endnodes = [parent_pos];
            max.row = parent_pos.row;
            max.col = parent_pos.col;
        }

        if (root.tagName == 'description' && illustrator.elements[root.tagName].closing_symbol) {
            pos.row++;
            max.row = pos.row;
            draw_position(illustrator.elements['start'].closing_symbol, pos, prev, block, group, [], this, {
                svg: group,
                pos: pos
            });
        }


        return {'endnodes': endnodes, 'max': max, 'svg': group};
    } // }}}
    var sym_name = function (tname, context) { //{{{
        var sname;
        if (!illustrator.elements[tname]) {
            sname = 'unknown';
        } else if (typeof illustrator.elements[tname].resolve_symbol == 'function') {
            sname = illustrator.elements[tname].resolve_symbol(context, illustrator.elements[tname].col_shift ? illustrator.elements[tname].col_shift(context) : undefined);
        } else if (typeof illustrator.elements[tname].resolve_symbol == 'string') {
            sname = illustrator.elements[tname].resolve_symbol;
        } else {
            sname = tname;
        }
        if (sname == null) {
            sname = tname;
        }
        return sname;
    } //}}}
    var set_details = function (tname, sname, pos, context, simple) { //{{{
        if (simple == undefined || simple == false) {
            if ($(context).attr('id') == undefined) {
                if (id_counter[tname] == undefined) id_counter[tname] = -1;
                $(context).attr('svg-id', tname + '_' + (++id_counter[tname]));
            } else {
                $(context).attr('svg-id', $(context).attr('id'));
            }
        }
        if (illustrator.elements[sname].label) {
            var lab = illustrator.elements[sname].label(context);
            if (lab && lab[0] && lab[0].value && lab[0].column == 'Label' && lab[0].value != '') {
                $(context).attr('svg-label', lab[0].value);
            }
            labels.push({
                ...{
                    row: pos.row,
                    col: pos.col,
                    element_id: $(context).attr('svg-id'),
                    tname: tname,
                    label: lab
                }, ...illustrator.draw.get_y(pos.row)
            });
        }
    } //}}}
    var draw_position = function (tname, pos, prev, block, group, endnodes, context, second) {
        var sname = sym_name(tname, context);
        let width = (estimateTextWidth($(context).attr('svg-label'))) / 40
        // Draw Symbol {{{
        if (second) {
            illustrator.draw.draw_symbol(sname, $(context).attr('svg-id'), $(context).attr('svg-label'), pos.row, pos.col, second.svg, true).addClass(illustrator.elements[sname] ? illustrator.elements[sname].type : 'primitive unknown');
        } else {
            $(context).attr('svg-type', tname);
            $(context).attr('svg-subtype', sname);
            if ((illustrator.elements[sname] && illustrator.elements[sname].svg) || sname == 'unknown') {
                var g = illustrator.draw.draw_symbol(sname, $(context).attr('svg-id'), $(context).attr('svg-label'), pos.row, pos.col, block.svg).addClass(illustrator.elements[sname] ? illustrator.elements[sname].type : 'primitive unknown');
                //block.max.col += width
                if (illustrator.elements[sname].info) {
                    var info = illustrator.elements[sname].info(context);
                    for (const [key, val] of Object.entries(info)) {
                        g.attr(key, val);
                    }
                }
            } else {
                console.log("no icon " + sname);
            }
            if (illustrator.elements[sname] && illustrator.elements[sname].border) {
                console.log( block.max.col,pos.col)

                var wide = (illustrator.elements[sname].wide == true && block.max.col == pos.col) ? pos.col + 1 : block.max.col;
                if (illustrator.elements[sname].closing_symbol) {
                    illustrator.draw.draw_border($(context).attr('svg-id'), pos, {
                        col: wide,
                        row: block.max.row + 1
                    }, block.svg,labels);
                } else {
                    illustrator.draw.draw_border($(context).attr('svg-id'), pos, {
                        col: wide,
                        row: block.max.row
                    }, block.svg,labels);
                }
            }
            if (illustrator.elements[sname] && illustrator.elements[sname].type == 'complex') {
                var wide = (illustrator.elements[sname].wide == true && block.max.col == pos.col) ? pos.col + 1 : block.max.col;
                if (illustrator.elements[sname].closing_symbol) {
                    illustrator.draw.draw_tile($(context).attr('svg-id'), pos, {
                        col: wide,
                        row: block.max.row + 1
                    }, block.svg,labels);
                } else {
                    illustrator.draw.draw_tile($(context).attr('svg-id'), pos, {
                        col: wide,
                        row: block.max.row
                    }, block.svg,labels);
                }
            }
        }
        // Calculate Connection {{{
        if (illustrator.elements[sname] != undefined && illustrator.elements[sname].closeblock == true) {// Close Block if element e.g. loop
            if (second) {
                if (second.pos.row + 1 < pos.row) { // when no content, dont paint the up arrow
                    illustrator.draw.draw_connection(group, pos, second.pos, block.max.row + 1, 1, true, context);
                }
            } else {
                for (node in block.endnodes) {
                    if (!block.endnodes[node].final) {
                        illustrator.draw.draw_connection(group, block.endnodes[node], pos, block.max.row + 1, block.endnodes.length, true, context);
                    }
                }
            }
        }
        if (illustrator.elements[sname] != undefined && illustrator.elements[sname].endnodes != 'this') {
            for (i in block.endnodes) {
                endnodes.push(block.endnodes[i]);
            } // collects all endpoints from different childs e.g. alternatives from choose
        } else {
            endnodes = [jQuery.extend(true, {}, pos)];
        } // sets this element as only endpoint (aggregate)
        if (prev[0].row == 0 || prev[0].col == 0) { // this enforces the connection from description to the first element
            illustrator.draw.draw_connection(group, {row: 1, col: 1}, pos, null, null, true, context);
        } else {
            if (illustrator.elements[sname].noarrow == undefined || illustrator.elements[sname].noarrow == false) {
                for (node in prev) {
                    if (typeof prev[node] === 'object' && prev[node] !== null && !Array.isArray(prev[node])) {
                        if (!prev[node].final) {
                            if (prev[node].wide) {
                                var pn = jQuery.extend(true, {}, prev[node]);
                                if (pos.col > prev[node].col) {
                                    pn.col = pos.col;
                                }
                                illustrator.draw.draw_connection(group, pn, pos, null, null, true, context);
                            } else {
                                illustrator.draw.draw_connection(group, prev[node], pos, null, null, true, context);
                            }
                        }
                    }
                }
            } else {
                for (node in prev) {
                    if (typeof prev[node] === 'object' && prev[node] !== null && !Array.isArray(prev[node])) {
                        if (!node.final) {
                            illustrator.draw.draw_connection(group, prev[node], pos, null, null, false, context);
                        }
                    }
                }
            }
        }
        // }}}
        return [g, endnodes];
    }

    //  Initialze {{{
    adaptor = wf_adaptor;
    illustrator = wf_illustrator;
    // }}}
} // }}}
