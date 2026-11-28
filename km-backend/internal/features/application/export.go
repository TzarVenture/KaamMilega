package application

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
)

// Export: an employer downloads their applicants (one job, or all jobs) as an Excel file. Every
// cell is written as text, so phone numbers keep their + and leading zeros and nothing in a
// candidate's details can run as a formula.

const exportMaxRows = 5000

var ErrExportTooBig = apperr.New("EXPORT_TOO_BIG", "there are more than 5000 applicants here; pick one job or one stage to export")

var exportHeader = []string{"Name", "Mobile", "Email", "City", "Job", "Stage", "Applied on", "Rating", "Your note", "Skills", "Headline", "Resume", "Profile"}

// stageLabel is how a stage reads in the file (Rejected shows as "Not selected", as in the portal)
func stageLabel(s string) string {
	if s == "Rejected" {
		return "Not selected"
	}
	return s
}

// exportRows turns applicants into rows under exportHeader
func exportRows(items []ApplicationDetail, siteURL string) [][]string {
	ist := time.FixedZone("IST", 5*3600+1800)
	rows := make([][]string, 0, len(items))
	for _, a := range items {
		var name, mobile, email, city, skills, headline, profile string
		if c := a.Candidate; c != nil {
			name, mobile, email, city, headline = c.Name, c.Mobile, c.Email, c.City, c.Headline
			skills = strings.Join(c.Skills, ", ")
			profile = siteURL + "/profile/" + c.ID
		}
		job := ""
		if a.Job != nil {
			job = a.Job.Title
		}
		rating := ""
		if a.Rating > 0 {
			rating = fmt.Sprintf("%d/5", a.Rating)
		}
		rows = append(rows, []string{
			name, mobile, email, city, job, stageLabel(a.Status), a.CreatedAt.In(ist).Format("02 Jan 2006"),
			rating, a.Note, skills, headline, a.ResumeURL, profile,
		})
	}
	return rows
}

// xlsxColumn is the spreadsheet column name for a 0-based index (A, B, … Z, AA …)
func xlsxColumn(i int) string {
	s := ""
	for i++; i > 0; i = (i - 1) / 26 {
		s = string(rune('A'+(i-1)%26)) + s
	}
	return s
}

func xmlText(s string) string {
	var b bytes.Buffer
	// Characters XML can't hold (control codes) are dropped
	clean := strings.Map(func(r rune) rune {
		if r == '\t' || r == '\n' || r == '\r' || r >= 0x20 {
			return r
		}
		return -1
	}, s)
	_ = xml.EscapeText(&b, []byte(clean))
	return b.String()
}

// buildXLSX writes a one-sheet Excel file with a bold header row; every cell is text
func buildXLSX(sheet string, header []string, rows [][]string) ([]byte, error) {
	var sh strings.Builder
	sh.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>`)
	for i := range header {
		fmt.Fprintf(&sh, `<col min="%d" max="%d" width="%d" customWidth="1"/>`, i+1, i+1, 22)
	}
	sh.WriteString(`</cols><sheetData>`)
	write := func(r int, cells []string, style int) {
		fmt.Fprintf(&sh, `<row r="%d">`, r)
		for i, v := range cells {
			if len([]rune(v)) > 32000 { // Excel's cell limit
				v = string([]rune(v)[:32000])
			}
			fmt.Fprintf(&sh, `<c r="%s%d" t="inlineStr" s="%d"><is><t xml:space="preserve">%s</t></is></c>`, xlsxColumn(i), r, style, xmlText(v))
		}
		sh.WriteString(`</row>`)
	}
	write(1, header, 1)
	for i, row := range rows {
		write(i+2, row, 2)
	}
	sh.WriteString(`</sheetData></worksheet>`)

	files := []struct{ name, body string }{
		{"[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
		{"_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
		{"xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="` + xmlText(sheet) + `" sheetId="1" r:id="rId1"/></sheets></workbook>`},
		{"xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
		// Style 1: bold header; style 2: text (number format 49 "@") so Excel never reads cells as numbers
		{"xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`},
		{"xl/worksheets/sheet1.xml", sh.String()},
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, f := range files {
		w, err := zw.Create(f.name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write([]byte(f.body)); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ExportApplicants gathers every applicant matching the filter (up to exportMaxRows)
func (s *ApplicationService) ExportApplicants(ctx context.Context, userID string, f PipelineFilter, jobID string) ([]ApplicationDetail, error) {
	var all []ApplicationDetail
	f.Limit = 100
	for f.Page = 1; ; f.Page++ {
		page, err := s.Pipeline(ctx, userID, f, jobID)
		if err != nil {
			return nil, err
		}
		if page.Total > exportMaxRows {
			return nil, ErrExportTooBig
		}
		all = append(all, page.Items...)
		if len(page.Items) < f.Limit || int64(len(all)) >= page.Total {
			return all, nil
		}
	}
}

// GET /api/applications/recruiter/export?job_id=&status=&search=
func (c *ApplicationController) Export(ctx *fiber.Ctx) error {
	userID, _ := ctx.Locals("user_id").(string)
	reqCtx, cancel := context.WithTimeout(ctx.Context(), 60*time.Second)
	defer cancel()
	items, err := c.service.ExportApplicants(reqCtx, userID, PipelineFilter{
		Status: ctx.Query("status"), Search: ctx.Query("search"), Sort: "newest",
	}, ctx.Query("job_id"))
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	site := strings.TrimRight(strings.TrimSpace(c.config.FrontendURL), "/")
	if site == "" {
		site = "https://kaammilega.com"
	}
	file, err := buildXLSX("Applicants", exportHeader, exportRows(items, site))
	if err != nil {
		return apperr.Respond(ctx, err)
	}
	name := "applicants-" + time.Now().Format("2006-01-02") + ".xlsx"
	ctx.Set(fiber.HeaderContentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	ctx.Set(fiber.HeaderContentDisposition, `attachment; filename="`+name+`"`)
	ctx.Set(fiber.HeaderCacheControl, "no-store")
	return ctx.Send(file)
}
