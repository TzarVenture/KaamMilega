package job

import (
	"context"
	"strings"
	"sync"

	"km-backend/internal/common/apperr"

	"github.com/gofiber/fiber/v2"
)

// maxCountTerms caps how many counts one request may ask for, so the endpoint can't be used to
// run hundreds of searches at once
const maxCountTerms = 20

// CountsResponse holds the number of open jobs for each search word and each education level
type CountsResponse struct {
	Search    map[string]int64 `json:"search"`
	Education map[string]int64 `json:"education"`
}

// CountJobs counts the listed jobs for each search word and each education value, one at a time
// per value (the home page's category and qualification cards)
func (s *JobService) CountJobs(ctx context.Context, search, education []string) (*CountsResponse, error) {
	out := &CountsResponse{Search: map[string]int64{}, Education: map[string]int64{}}
	var (
		mu       sync.Mutex
		wg       sync.WaitGroup
		firstErr error
	)
	run := func(into map[string]int64, key string, filter JobFilter) {
		defer wg.Done()
		n, err := s.repo.Count(ctx, filter)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			return
		}
		into[key] = n
	}
	for _, q := range search {
		wg.Add(1)
		go run(out.Search, q, JobFilter{Search: q})
	}
	for _, e := range education {
		wg.Add(1)
		// "diploma,iti" counts jobs matching either
		go run(out.Education, e, JobFilter{Education: strings.Split(e, ",")})
	}
	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	return out, nil
}

// countTerms reads a repeated query value (?search=a&search=b), dropping blanks and duplicates
func countTerms(ctx *fiber.Ctx, key string) []string {
	seen := map[string]bool{}
	var out []string
	for _, raw := range ctx.Context().QueryArgs().PeekMulti(key) {
		v := strings.TrimSpace(string(raw))
		if v == "" || len(v) > 60 || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

// GetJobCounts: GET /api/jobs/counts?search=sales&search=nurse&education=10th&education=diploma,iti
func (c *JobController) GetJobCounts(ctx *fiber.Ctx) error {
	search, education := countTerms(ctx, "search"), countTerms(ctx, "education")
	if len(search)+len(education) == 0 {
		return ctx.Status(fiber.StatusBadRequest).JSON(apperr.Body(apperr.New("BAD_REQUEST", "Ask for at least one count.")))
	}
	if len(search)+len(education) > maxCountTerms {
		return ctx.Status(fiber.StatusBadRequest).JSON(apperr.Body(apperr.New("BAD_REQUEST", "Too many counts in one request.")))
	}
	counts, err := c.service.CountJobs(ctx.Context(), search, education)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=60")
	return ctx.JSON(counts)
}
