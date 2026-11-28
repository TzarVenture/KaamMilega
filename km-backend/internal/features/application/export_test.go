package application

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestBuildXLSXKeepsTextAndEscapes(t *testing.T) {
	file, err := buildXLSX("Applicants", []string{"Name", "Mobile"}, [][]string{{"राम <Kumar> & Co", "+919876543210"}, {"=HYPERLINK(\"x\")", "0098"}})
	if err != nil {
		t.Fatal(err)
	}
	zr, err := zip.NewReader(bytes.NewReader(file), int64(len(file)))
	if err != nil {
		t.Fatal(err)
	}
	var sheet string
	for _, f := range zr.File {
		if f.Name == "xl/worksheets/sheet1.xml" {
			rc, _ := f.Open()
			b, _ := io.ReadAll(rc)
			sheet = string(b)
		}
	}
	for _, want := range []string{"राम &lt;Kumar&gt; &amp; Co", "+919876543210", "0098", `t="inlineStr"`, `r="B3"`} {
		if !strings.Contains(sheet, want) {
			t.Errorf("sheet missing %q", want)
		}
	}
	if strings.Contains(sheet, "<f>") {
		t.Error("no cell may be a formula")
	}
}

func TestXLSXColumn(t *testing.T) {
	for i, want := range map[int]string{0: "A", 25: "Z", 26: "AA", 27: "AB", 701: "ZZ", 702: "AAA"} {
		if got := xlsxColumn(i); got != want {
			t.Errorf("xlsxColumn(%d) = %s, want %s", i, got, want)
		}
	}
}

func TestExportRowsShowsNotSelected(t *testing.T) {
	rows := exportRows([]ApplicationDetail{{Status: "Rejected", Rating: 4, Candidate: &CandidateInfo{ID: "abc", Name: "A", Skills: []string{"x", "y"}}}}, "https://k.com")
	r := rows[0]
	if r[5] != "Not selected" || r[7] != "4/5" || r[9] != "x, y" || r[12] != "https://k.com/profile/abc" {
		t.Errorf("unexpected row %v", r)
	}
}
