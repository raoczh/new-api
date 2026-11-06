package service

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const (
	imageStudioSVGNamespace   = "http://www.w3.org/2000/svg"
	imageStudioXLinkNamespace = "http://www.w3.org/1999/xlink"
	imageStudioXMLNamespace   = "http://www.w3.org/XML/1998/namespace"
	imageStudioMaxSVGBytes    = 4 << 20
	imageStudioMaxSVGDepth    = 64
	imageStudioMaxSVGElements = 10000
)

var (
	imageStudioSVGDeclaration = regexp.MustCompile(`^version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"UTF-8"|'UTF-8'|"utf-8"|'utf-8'))?(?:\s+standalone\s*=\s*(?:"(?:yes|no)"|'(?:yes|no)'))?\s*$`)
	imageStudioSVGIdentifier  = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]*$`)
	imageStudioSVGFragment    = regexp.MustCompile(`^#[A-Za-z_][A-Za-z0-9_.-]*$`)
	imageStudioSVGLocalPaint  = regexp.MustCompile(`^url\((?:#[A-Za-z_][A-Za-z0-9_.-]*|'#[A-Za-z_][A-Za-z0-9_.-]*'|"#[A-Za-z_][A-Za-z0-9_.-]*")\)$`)
	imageStudioSVGColor       = regexp.MustCompile(`^(?:[A-Za-z]+(?:-[A-Za-z]+)*|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9+.,% /-]+\))$`)
	imageStudioSVGNumberList  = regexp.MustCompile(`^[0-9eE+.,% \t\r\n-]+$`)
	imageStudioSVGLength      = regexp.MustCompile(`^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?(?:%|px|pt|pc|mm|cm|in|em|ex)?$`)
	imageStudioSVGPath        = regexp.MustCompile(`^[MmZzLlHhVvCcSsQqTtAa0-9eE+., \t\r\n-]*$`)
	imageStudioSVGTransform   = regexp.MustCompile(`^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([0-9eE+., \t\r\n-]+\)[\s,]*)+$`)
	imageStudioSVGWords       = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 ,'-]*$`)
)

// validateImageStudioSVG accepts a deliberately small, static SVG language.
// Unlike plugin icons, results can be opened as documents on a public CDN, so
// an <img> sandbox or response headers cannot be the security boundary. Reject
// unsupported content rather than stripping it and silently changing the image.
func validateImageStudioSVG(data []byte) error {
	if len(data) == 0 || len(data) > imageStudioMaxSVGBytes {
		return fmt.Errorf("%w: SVG must be at most %d bytes", ErrImageStudioFileInvalid, imageStudioMaxSVGBytes)
	}
	decoder := xml.NewDecoder(bytes.NewReader(bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})))
	depth := 0
	elementCount := 0
	rootSeen := false
	for {
		tokenOffset := decoder.InputOffset()
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("%w: SVG is not well-formed XML", ErrImageStudioFileInvalid)
		}
		switch element := token.(type) {
		case xml.Directive:
			return fmt.Errorf("%w: SVG directives are not allowed", ErrImageStudioFileInvalid)
		case xml.ProcInst:
			if tokenOffset != 0 || element.Target != "xml" || !imageStudioSVGDeclaration.Match(element.Inst) {
				return fmt.Errorf("%w: SVG processing instructions are not allowed", ErrImageStudioFileInvalid)
			}
		case xml.StartElement:
			if element.Name.Space != imageStudioSVGNamespace || (depth == 0 && (rootSeen || element.Name.Local != "svg")) {
				return fmt.Errorf("%w: SVG requires one svg root and the SVG namespace", ErrImageStudioFileInvalid)
			}
			rootSeen = true
			depth++
			elementCount++
			if depth > imageStudioMaxSVGDepth || elementCount > imageStudioMaxSVGElements || len(element.Attr) > 64 {
				return fmt.Errorf("%w: SVG exceeds static document limits", ErrImageStudioFileInvalid)
			}
			switch element.Name.Local {
			case "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
				"text", "tspan", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "marker":
			default:
				return fmt.Errorf("%w: SVG contains an unsupported element", ErrImageStudioFileInvalid)
			}
			attributesSeen := make(map[xml.Name]bool, len(element.Attr))
			for _, attribute := range element.Attr {
				if attributesSeen[attribute.Name] || !validateImageStudioSVGAttribute(element.Name.Local, attribute) {
					return fmt.Errorf("%w: SVG contains an unsupported attribute or value", ErrImageStudioFileInvalid)
				}
				attributesSeen[attribute.Name] = true
			}
		case xml.EndElement:
			depth--
		case xml.CharData:
			if depth == 0 && strings.TrimSpace(string(element)) != "" {
				return fmt.Errorf("%w: SVG contains text outside its root", ErrImageStudioFileInvalid)
			}
		}
	}
	if !rootSeen || depth != 0 {
		return fmt.Errorf("%w: SVG requires a complete svg root", ErrImageStudioFileInvalid)
	}
	return nil
}

func validateImageStudioSVGAttribute(elementName string, attribute xml.Attr) bool {
	if attribute.Name.Space == "" && attribute.Name.Local == "xmlns" {
		return attribute.Value == imageStudioSVGNamespace
	}
	if attribute.Name.Space == "xmlns" {
		return attribute.Name.Local != "xmlns" && attribute.Name.Local != "xml" &&
			(attribute.Value == imageStudioSVGNamespace || attribute.Value == imageStudioXLinkNamespace)
	}
	if attribute.Name.Space == imageStudioXMLNamespace {
		return attribute.Name.Local == "space" && (attribute.Value == "default" || attribute.Value == "preserve")
	}
	if attribute.Name.Space != "" && attribute.Name.Space != imageStudioXLinkNamespace {
		return false
	}
	if attribute.Name.Local == "href" {
		// Only paint-server inheritance can reference another static local node.
		// Links, images, use expansion and SMIL are not in the element allowlist.
		return (elementName == "linearGradient" || elementName == "radialGradient" || elementName == "pattern") &&
			imageStudioSVGFragment.MatchString(attribute.Value)
	}
	if attribute.Name.Space != "" {
		return false
	}
	value := strings.TrimSpace(attribute.Value)
	switch attribute.Name.Local {
	case "id":
		return imageStudioSVGIdentifier.MatchString(value)
	case "fill", "stroke":
		return imageStudioSVGColor.MatchString(value) || imageStudioSVGLocalPaint.MatchString(value)
	case "color", "stop-color":
		return imageStudioSVGColor.MatchString(value)
	case "clip-path", "mask", "marker-start", "marker-mid", "marker-end":
		return value == "none" || imageStudioSVGLocalPaint.MatchString(value)
	case "d":
		return imageStudioSVGPath.MatchString(value)
	case "transform", "gradientTransform", "patternTransform":
		return imageStudioSVGTransform.MatchString(value)
	case "viewBox", "points", "dx", "dy", "rotate", "stroke-dasharray":
		return imageStudioSVGNumberList.MatchString(value) || (attribute.Name.Local == "stroke-dasharray" && value == "none")
	case "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "width", "height",
		"opacity", "fill-opacity", "stroke-opacity", "stroke-width", "stroke-miterlimit", "stroke-dashoffset", "offset", "stop-opacity",
		"font-size", "letter-spacing", "word-spacing", "textLength", "refX", "refY", "markerWidth", "markerHeight":
		return imageStudioSVGLength.MatchString(value)
	case "version":
		return value == "1.0" || value == "1.1" || value == "2.0"
	case "orient":
		return value == "auto" || value == "auto-start-reverse" || imageStudioSVGLength.MatchString(value)
	case "preserveAspectRatio", "fill-rule", "clip-rule", "stroke-linecap", "stroke-linejoin", "gradientUnits", "spreadMethod",
		"clipPathUnits", "maskUnits", "maskContentUnits", "patternUnits", "patternContentUnits", "markerUnits", "vector-effect",
		"font-family", "font-style", "font-weight", "text-anchor", "dominant-baseline", "alignment-baseline", "lengthAdjust",
		"display", "visibility", "overflow", "shape-rendering", "text-rendering":
		// No CSS escapes, functions, selectors, declarations or at-rules. In
		// particular, neither style elements nor style attributes are accepted.
		return imageStudioSVGWords.MatchString(value) || (attribute.Name.Local == "font-weight" && imageStudioSVGNumberList.MatchString(value))
	default:
		return false
	}
}
