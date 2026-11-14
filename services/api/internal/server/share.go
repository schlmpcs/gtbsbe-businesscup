package server

import (
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
	"image"
	"image/color"
)

func drawText(dst *image.RGBA, x, y int, text string, scale int, c color.RGBA) {
	tmp := image.NewRGBA(image.Rect(0, 0, len(text)*7, 15))
	d := font.Drawer{Dst: tmp, Src: image.NewUniform(c), Face: basicfont.Face7x13, Dot: fixed.P(0, 12)}
	d.DrawString(text)
	for yy := 0; yy < 15; yy++ {
		for xx := 0; xx < len(text)*7; xx++ {
			p := tmp.RGBAAt(xx, yy)
			if p.A > 0 {
				for dy := 0; dy < scale; dy++ {
					for dx := 0; dx < scale; dx++ {
						dst.SetRGBA(x+xx*scale+dx, y+yy*scale+dy, p)
					}
				}
			}
		}
	}
}
