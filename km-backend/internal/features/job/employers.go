package job

import (
	"context"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// EmployerSource is the one user-repository call the job service needs. It is kept
// as a function so this package does not import the user package.
type EmployerSource func(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]Employer, error)

func (f EmployerSource) Employers(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]Employer, error) {
	return f(ctx, ids)
}
