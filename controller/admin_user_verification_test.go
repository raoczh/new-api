package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupAdminUserTest promotes the enrolled operator to root and creates a
// managed common user for the administrative endpoints to act on.
func setupAdminUserTest(t *testing.T) (*model.User, service.AuthIdentity, *model.User) {
	t.Helper()
	operator, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.Model(operator).Update("role", common.RoleRootUser).Error)
	require.NoError(t, model.PublishUserAuthCache(operator.Id))
	password, err := common.Password2Hash("managed-password")
	require.NoError(t, err)
	target := &model.User{Username: "managed-user", Password: password, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "managed-aff", GitHubId: "managed-github"}
	require.NoError(t, model.DB.Create(target).Error)
	return operator, identity, target
}

const managedTokenSecret = "managed-token-secret"

// managedTokenID returns the id of the managed user's key fixture. The id is
// read back from the database because it is auto-generated per test run.
func managedTokenID(t *testing.T, userId int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Where("user_id = ?", userId).First(&token).Error)
	return token.Id
}

func storedTokenKey(t *testing.T, userId int) string {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Where("user_id = ?", userId).First(&token).Error)
	return token.Key
}

// adminUserRequest drives an admin user-management handler with the operator
// context that AdminAuth would have populated for a dashboard session.
func adminUserRequest(method, path, body, proof string, identity service.AuthIdentity, role int, params gin.Params, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if proof != "" {
		c.Request.Header.Set("X-Security-Proof", proof)
	}
	c.Params = params
	c.Set("id", identity.UserID)
	c.Set("username", "enrollment-user")
	c.Set("role", role)
	c.Set("session_id", identity.SessionID)
	c.Set("auth_version", identity.UserAuthVersion)
	c.Set("session_version", identity.SessionVersion)
	handler(c)
	return response
}

func TestAdminUserRiskOperationsRequireProofBeforeMutation(t *testing.T) {
	for _, test := range []struct {
		name, method, path string
		body               func(target *model.User) string
		params             func(target *model.User) gin.Params
		handler            gin.HandlerFunc
		unchanged          func(t *testing.T, target *model.User)
		// 有些操作的价值在于“不泄露”，泄露只出现在响应体里，因此单独留一个断言位。
		responseMustNotContain string
	}{
		{
			name: "hard delete", method: http.MethodDelete, path: "/api/user/:id", handler: DeleteUser,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetUserById(target.Id, false)
				assert.NoError(t, err)
			},
		},
		{
			name: "manage disable", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, common.UserStatusEnabled, stored.Status)
			},
		},
		{
			name: "manage promote", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"promote"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, common.RoleCommonUser, stored.Role)
			},
		},
		{
			name: "manage delete", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"delete"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetUserById(target.Id, false)
				assert.NoError(t, err)
			},
		},
		{
			name: "password reset", method: http.MethodPut, path: "/api/user/", handler: UpdateUser,
			body: func(target *model.User) string {
				return fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Managed","password":"replacement-pass"}`, target.Id)
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, true)
				require.NoError(t, err)
				assert.True(t, common.ValidatePasswordAndHash("managed-password", stored.Password))
			},
		},
		{
			name: "admin permission matrix", method: http.MethodPut, path: "/api/user/", handler: UpdateUser,
			body: func(target *model.User) string {
				return fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Managed","admin_permissions":{}}`, target.Id)
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, "", stored.DisplayName)
			},
		},
		{
			name: "create administrator", method: http.MethodPost, path: "/api/user/", handler: CreateUser,
			body: func(*model.User) string { return `{"username":"new-admin","password":"admin-password-1","role":10}` },
			unchanged: func(t *testing.T, _ *model.User) {
				var count int64
				require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-admin").Count(&count).Error)
				assert.Zero(t, count)
			},
		},
		{
			name: "passkey reset", method: http.MethodDelete, path: "/api/user/:id/reset_passkey", handler: AdminResetPasskey,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetPasskeyByUserID(target.Id)
				assert.NoError(t, err)
			},
		},
		{
			name: "two-factor disable", method: http.MethodDelete, path: "/api/user/:id/2fa", handler: AdminDisable2FA,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				twoFA, err := model.GetTwoFAByUserId(target.Id)
				require.NoError(t, err)
				assert.True(t, twoFA.IsEnabled)
			},
		},
		{
			name: "built-in binding clear", method: http.MethodDelete, path: "/api/user/:id/bindings/:binding_type", handler: AdminClearUserBinding,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "binding_type", Value: "github"}}
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, "managed-github", stored.GitHubId)
			},
		},
		{
			name: "custom oauth unbind", method: http.MethodDelete, path: "/api/user/:id/oauth/bindings/:provider_id", handler: UnbindCustomOAuthByAdmin,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "provider_id", Value: "7"}}
			},
			unchanged: func(t *testing.T, target *model.User) {
				bindings, err := model.GetUserOAuthBindingsByUserId(target.Id)
				require.NoError(t, err)
				assert.Len(t, bindings, 1)
			},
		},
		{
			name: "token delete", method: http.MethodDelete, path: "/api/user/:id/tokens/:token_id", handler: AdminDeleteUserToken,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "token_id", Value: fmt.Sprint(managedTokenID(t, target.Id))}}
			},
			unchanged: func(t *testing.T, target *model.User) {
				var count int64
				require.NoError(t, model.DB.Model(&model.Token{}).Where("user_id = ?", target.Id).Count(&count).Error)
				assert.EqualValues(t, 1, count)
			},
		},
		{
			name: "token key read", method: http.MethodGet, path: "/api/user/:id/tokens/:token_id/key", handler: AdminGetUserTokenKey,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "token_id", Value: fmt.Sprint(managedTokenID(t, target.Id))}}
			},
			responseMustNotContain: managedTokenSecret,
			unchanged: func(t *testing.T, target *model.User) {
				assert.Equal(t, managedTokenSecret, storedTokenKey(t, target.Id))
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, identity, target := setupAdminUserTest(t)
			require.NoError(t, model.DB.AutoMigrate(&model.Token{}, &model.UserGroup{}))
			require.NoError(t, model.DB.Create(&model.PasskeyCredential{UserID: target.Id, CredentialID: "managed-passkey", PublicKey: "public-key"}).Error)
			require.NoError(t, model.DB.Create(&model.TwoFA{UserId: target.Id, Secret: "JBSWY3DPEHPK3PXP", IsEnabled: true}).Error)
			require.NoError(t, model.DB.Create(&model.UserOAuthBinding{UserId: target.Id, ProviderId: 7, ProviderUserId: "provider-user"}).Error)
			require.NoError(t, model.DB.Create(&model.Token{UserId: target.Id, Key: managedTokenSecret, Name: "managed-key", Status: common.TokenStatusEnabled, Group: "default"}).Error)
			var body string
			if test.body != nil {
				body = test.body(target)
			}
			var params gin.Params
			if test.params != nil {
				params = test.params(target)
			}
			response := adminUserRequest(test.method, test.path, body, "", identity, common.RoleRootUser, params, test.handler)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Equal(t, "SECURITY_PROOF_REQUIRED", result.Code)
			test.unchanged(t, target)
			if test.responseMustNotContain != "" {
				assert.NotContains(t, response.Body.String(), test.responseMustNotContain)
			}
			var flows int64
			require.NoError(t, model.DB.Model(&model.AuthFlow{}).Count(&flows).Error)
			assert.Zero(t, flows)
		})
	}
}

// An administrator (not root) exercises the routine paths without touching the
// Casbin policy store, which the security fixture does not provision.
func TestAdminUserRoutineEditsDoNotRequireProof(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	response := adminUserRequest(http.MethodPut, "/api/user/", fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Renamed","group":"default"}`, target.Id), "", identity, common.RoleAdminUser, nil, UpdateUser)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	stored, err := model.GetUserById(target.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "Renamed", stored.DisplayName)
	assert.True(t, common.ValidatePasswordAndHash("managed-password", stored.Password))

	response = adminUserRequest(http.MethodPost, "/api/user/", `{"username":"new-member","password":"member-password-1","role":1}`, "", identity, common.RoleAdminUser, nil, CreateUser)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-member").Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestCreateUserRejectsNonStandardRole(t *testing.T) {
	_, identity, _ := setupAdminUserTest(t)
	for i, test := range []struct {
		name         string
		role         int
		operatorRole int
	}{
		{"between common and admin", 5, common.RoleAdminUser},
		{"negative", -1, common.RoleAdminUser},
		{"between admin and root", 99, common.RoleRootUser},
	} {
		t.Run(test.name, func(t *testing.T) {
			username := fmt.Sprintf("odd-role-%d", i)
			body := fmt.Sprintf(`{"username":%q,"password":"member-password-1","role":%d}`, username, test.role)
			response := adminUserRequest(http.MethodPost, "/api/user/", body, "", identity, test.operatorRole, nil, CreateUser)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusOK, response.Code)
			assert.False(t, result.Success)
			assert.Empty(t, result.Code)
			var count int64
			require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", username).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestAdminUserProofIsBoundToTargetAndActionAndConsumedOnce(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	other := &model.User{Username: "other-user", Password: target.Password, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "other-aff"}
	require.NoError(t, model.DB.Create(other).Error)
	disableTarget := service.VerificationOperation{Scope: service.VerificationScopeAdminUserManage, Context: []byte(fmt.Sprintf(`{"user_id":%d,"action":"disable"}`, target.Id))}
	proof := issueSecurityEnrollmentProof(t, identity, disableTarget, service.VerificationMethodPassword)

	for _, test := range []struct {
		name, body, code string
		params           gin.Params
		handler          gin.HandlerFunc
	}{
		{"different action", fmt.Sprintf(`{"id":%d,"action":"enable"}`, target.Id), "SECURITY_PROOF_CONTEXT_MISMATCH", nil, ManageUser},
		{"different user", fmt.Sprintf(`{"id":%d,"action":"disable"}`, other.Id), "SECURITY_PROOF_CONTEXT_MISMATCH", nil, ManageUser},
		{"different scope", "", "SECURITY_PROOF_SCOPE_MISMATCH", gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}}, DeleteUser},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := adminUserRequest(http.MethodPost, "/api/user/manage", test.body, proof, identity, common.RoleRootUser, test.params, test.handler)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Equal(t, test.code, result.Code)
		})
	}
	for _, id := range []int{target.Id, other.Id} {
		stored, err := model.GetUserById(id, false)
		require.NoError(t, err)
		assert.Equal(t, common.UserStatusEnabled, stored.Status)
	}

	response := adminUserRequest(http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id), proof, identity, common.RoleRootUser, nil, ManageUser)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	stored, err := model.GetUserById(target.Id, false)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, stored.Status)
	var audit model.AuditLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "user.manage").Last(&audit).Error)
	require.NotNil(t, audit.Other.Op)
	verificationMethod, err := common.Marshal(audit.Other.Op.Params["verification_method"])
	require.NoError(t, err)
	assert.JSONEq(t, `"password"`, string(verificationMethod))
	targetUserID, err := common.Marshal(audit.Other.Op.Params["target_user_id"])
	require.NoError(t, err)
	assert.JSONEq(t, fmt.Sprint(target.Id), string(targetUserID))
	auditJSON, err := common.Marshal(audit)
	require.NoError(t, err)
	assert.NotContains(t, string(auditJSON), proof)

	response = adminUserRequest(http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id), proof, identity, common.RoleRootUser, nil, ManageUser)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Equal(t, "SECURITY_PROOF_CONSUMED", result.Code)
}

func TestAdminUserBindingProofDistinguishesBuiltInAndCustomBindings(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	require.NoError(t, model.DB.Create(&model.UserOAuthBinding{UserId: target.Id, ProviderId: 7, ProviderUserId: "provider-user"}).Error)
	custom := service.VerificationOperation{Scope: service.VerificationScopeAdminUserBindingClear, Context: []byte(fmt.Sprintf(`{"user_id":%d,"provider_id":7}`, target.Id))}
	proof := issueSecurityEnrollmentProof(t, identity, custom, service.VerificationMethodPassword)
	params := gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "binding_type", Value: "github"}}
	response := adminUserRequest(http.MethodDelete, "/api/user/:id/bindings/:binding_type", "", proof, identity, common.RoleRootUser, params, AdminClearUserBinding)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.Equal(t, "SECURITY_PROOF_CONTEXT_MISMATCH", result.Code)
	stored, err := model.GetUserById(target.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "managed-github", stored.GitHubId)

	params = gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "provider_id", Value: "7"}}
	response = adminUserRequest(http.MethodDelete, "/api/user/:id/oauth/bindings/:provider_id", "", proof, identity, common.RoleRootUser, params, UnbindCustomOAuthByAdmin)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	bindings, err := model.GetUserOAuthBindingsByUserId(target.Id)
	require.NoError(t, err)
	assert.Empty(t, bindings)
	var audit model.AuditLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "user.binding_clear").Last(&audit).Error)
	require.NotNil(t, audit.Other.Op)
	providerID, err := common.Marshal(audit.Other.Op.Params["provider_id"])
	require.NoError(t, err)
	assert.JSONEq(t, "7", string(providerID))
}

func TestAdminUserVerificationPolicy(t *testing.T) {
	t.Run("requires an administrator", func(t *testing.T) {
		_, identity := setupSecurityEnrollmentTest(t)
		_, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserDelete)
		assert.ErrorIs(t, err, service.ErrVerificationForbidden)
	})
	t.Run("falls back to the password without a second factor", func(t *testing.T) {
		_, identity, _ := setupAdminUserTest(t)
		requirements, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserDelete)
		require.NoError(t, err)
		assert.Equal(t, []service.VerificationMethodOption{{Method: service.VerificationMethodPassword, Available: true}}, requirements.Methods)
	})
	t.Run("prefers an enrolled second factor", func(t *testing.T) {
		operator, identity, _ := setupAdminUserTest(t)
		require.NoError(t, model.DB.Create(&model.TwoFA{UserId: operator.Id, Secret: "JBSWY3DPEHPK3PXP", IsEnabled: true}).Error)
		requirements, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserManage)
		require.NoError(t, err)
		assert.Equal(t, []service.VerificationMethodOption{{Method: service.VerificationMethodTwoFA, Available: true}}, requirements.Methods)
	})
	t.Run("a legacy token cannot present a proof", func(t *testing.T) {
		operator, identity, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.Model(operator).Update("access_token", "legacy-admin-token").Error)
		proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAdminUserDelete, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, target.Id))}, service.VerificationMethodPassword)
		response := accessTokenRequest(newAccessTokenTestRouter(), http.MethodDelete, fmt.Sprintf("/api/user/%d", target.Id), "legacy-admin-token", proof, "")
		assert.Equal(t, http.StatusForbidden, response.Code)
		assert.Equal(t, "SECURITY_PROOF_INVALID", decodeSecurityEnrollmentResponse(t, response).Code)
		_, err := model.GetUserById(target.Id, false)
		assert.NoError(t, err)
	})
	t.Run("a user:write token completes the deletion on its own proof", func(t *testing.T) {
		operator, _, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.AutoMigrate(&model.ExternalIdentityClaim{}, &model.Token{}, &model.UserGroup{}))
		raw, _ := createScopedAccessToken(t, operator.Id, 0, "user:write")
		router := newAccessTokenTestRouter()
		response := accessTokenRequest(router, http.MethodPost, "/api/verify", raw, "", fmt.Sprintf(`{"scope":"admin.user.delete","method":"password","password":"enrollment-password","context":{"user_id":%d}}`, target.Id))
		body := decodeSecurityEnrollmentResponse(t, response)
		require.True(t, body.Success, body.Message)
		var proof service.SecurityProof
		require.NoError(t, common.Unmarshal(body.Data, &proof))

		response = accessTokenRequest(router, http.MethodDelete, fmt.Sprintf("/api/user/%d", target.Id), raw, proof.ProofToken, "")
		body = decodeSecurityEnrollmentResponse(t, response)
		require.True(t, body.Success, body.Message)
		_, err := model.GetUserById(target.Id, true)
		assert.Error(t, err)
		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.delete").Last(&audit).Error)
		assert.Equal(t, "access_token", audit.AuthMethod)
		auditJSON, err := common.Marshal(audit)
		require.NoError(t, err)
		for _, secret := range []string{raw, proof.ProofToken, "enrollment-password"} {
			assert.NotContains(t, string(auditJSON), secret)
		}
	})
	t.Run("a user:read token cannot obtain a proof", func(t *testing.T) {
		operator, _, target := setupAdminUserTest(t)
		raw, _ := createScopedAccessToken(t, operator.Id, 0, "user:read")
		response := accessTokenRequest(newAccessTokenTestRouter(), http.MethodPost, "/api/verify", raw, "", fmt.Sprintf(`{"scope":"admin.user.delete","method":"password","password":"enrollment-password","context":{"user_id":%d}}`, target.Id))
		assert.Equal(t, http.StatusForbidden, response.Code)
		assert.Equal(t, "SECURITY_ACTION_FORBIDDEN", decodeSecurityEnrollmentResponse(t, response).Code)
		var flows int64
		require.NoError(t, model.DB.Model(&model.AuthFlow{}).Count(&flows).Error)
		assert.Zero(t, flows)
	})
}

// adminUserGroupsPayload 是分组管理接口的响应形状，供测试断言使用。
type adminUserGroupsPayload struct {
	Group              string   `json:"group"`
	ExtraUsableGroups  []string `json:"extra_usable_groups"`
	HiddenUsableGroups []string `json:"hidden_usable_groups"`
	Groups             []struct {
		Name   string  `json:"name"`
		Desc   string  `json:"desc"`
		Ratio  float64 `json:"ratio"`
		Usable bool    `json:"usable"`
	} `json:"groups"`
}

func (payload adminUserGroupsPayload) usable(name string) (bool, bool) {
	for _, group := range payload.Groups {
		if group.Name == name {
			return group.Usable, true
		}
	}
	return false, false
}

// TestAdminUserGroupManagement 覆盖管理员查看与操作某个用户分组的接口：
// 列表要说明哪些分组可用，更新只动分组相关字段，非法输入不得落库。
func TestAdminUserGroupManagement(t *testing.T) {
	params := func(target *model.User) gin.Params {
		return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}}
	}
	decodeGroups := func(t *testing.T, response *httptest.ResponseRecorder) adminUserGroupsPayload {
		t.Helper()
		var body securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
		require.True(t, body.Success, response.Body.String())
		var payload adminUserGroupsPayload
		require.NoError(t, common.Unmarshal(body.Data, &payload))
		return payload
	}

	t.Run("viewing a user reports their usable groups", func(t *testing.T) {
		_, identity, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.AutoMigrate(&model.Token{}, &model.UserGroup{}))
		_, err := model.EnsureGroupId("managed-group")
		require.NoError(t, err)
		response := adminUserRequest(http.MethodGet, "/api/user/:id/groups", "", "", identity, common.RoleAdminUser, params(target), AdminGetUserGroups)
		payload := decodeGroups(t, response)
		assert.Equal(t, "default", payload.Group)
		usable, found := payload.usable("default")
		require.True(t, found, "the own group of the user must be listed")
		assert.True(t, usable, "the own group of the user is always usable")
		usable, found = payload.usable("managed-group")
		require.True(t, found, "registered groups are listed so an admin can grant them")
		assert.False(t, usable)
	})

	t.Run("changing groups keeps unrelated fields and overrides", func(t *testing.T) {
		_, identity, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.AutoMigrate(&model.UserGroup{}))
		before, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		_, err = model.EnsureGroupId("managed-group")
		require.NoError(t, err)
		body := `{"group":"managed-group","extra_usable_groups":["managed-group"],"hidden_usable_groups":[]}`
		response := adminUserRequest(http.MethodPut, "/api/user/:id/groups", body, "", identity, common.RoleAdminUser, params(target), AdminUpdateUserGroups)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())

		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, "managed-group", stored.Group)
		assert.Equal(t, before.Quota, stored.Quota)
		assert.Equal(t, before.Username, stored.Username)
		assert.Greater(t, stored.AuthVersion, before.AuthVersion, "a group change must invalidate old sessions")

		userSetting := stored.GetSetting()
		assert.Equal(t, []string{"managed-group"}, userSetting.ExtraUsableGroups)
		assert.Empty(t, userSetting.HiddenUsableGroups)

		response = adminUserRequest(http.MethodGet, "/api/user/:id/groups", "", "", identity, common.RoleAdminUser, params(target), AdminGetUserGroups)
		payload := decodeGroups(t, response)
		assert.Equal(t, "managed-group", payload.Group)
		assert.Equal(t, []string{"managed-group"}, payload.ExtraUsableGroups)
		usable, found := payload.usable("managed-group")
		require.True(t, found)
		assert.True(t, usable, "an extra visible group counts as usable")

		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.groups_update").Last(&audit).Error)
		require.NotNil(t, audit.Other.Op)
		previous, err := common.Marshal(audit.Other.Op.Params["previous_group"])
		require.NoError(t, err)
		assert.JSONEq(t, `"default"`, string(previous))
	})

	t.Run("rejects unknown groups and self hiding", func(t *testing.T) {
		_, identity, target := setupAdminUserTest(t)
		for _, test := range []struct {
			name, body string
		}{
			{"unknown group", `{"group":"no-such-group"}`},
			{"hiding the own group", `{"group":"default","hidden_usable_groups":["default"]}`},
			{"empty group", `{"group":"   "}`},
		} {
			response := adminUserRequest(http.MethodPut, "/api/user/:id/groups", test.body, "", identity, common.RoleAdminUser, params(target), AdminUpdateUserGroups)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.False(t, result.Success, test.name)
			stored, err := model.GetUserById(target.Id, false)
			require.NoError(t, err)
			assert.Equal(t, "default", stored.Group, test.name)
			assert.Empty(t, stored.GetSetting().HiddenUsableGroups, test.name)
		}
	})

	t.Run("a partial request keeps existing overrides", func(t *testing.T) {
		_, identity, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.Model(target).Update("setting", `{"extra_usable_groups":["default"]}`).Error)
		response := adminUserRequest(http.MethodPut, "/api/user/:id/groups", `{"group":"default"}`, "", identity, common.RoleAdminUser, params(target), AdminUpdateUserGroups)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, []string{"default"}, stored.GetSetting().ExtraUsableGroups)
	})
}

// TestAdminUserKeyOperations 覆盖管理员查看与操作用户密钥：列表只给掩码，
// 启用停用即时生效，读取明文与删除都需要二次校验并留痕。
func TestAdminUserKeyOperations(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}, &model.UserGroup{}))
	require.NoError(t, model.DB.Create(&model.Token{UserId: target.Id, Key: managedTokenSecret, Name: "managed-key", Status: common.TokenStatusEnabled, Group: "default"}).Error)
	tokenID := managedTokenID(t, target.Id)
	params := gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "token_id", Value: fmt.Sprint(tokenID)}}

	t.Run("listing masks the key", func(t *testing.T) {
		response := adminUserRequest(http.MethodGet, "/api/user/:id/tokens", "", "", identity, common.RoleAdminUser, gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}}, AdminGetUserTokens)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		assert.NotContains(t, response.Body.String(), managedTokenSecret)
	})

	t.Run("status changes take effect immediately", func(t *testing.T) {
		response := adminUserRequest(http.MethodPost, "/api/user/:id/tokens/:token_id/status", `{"status":2}`, "", identity, common.RoleAdminUser, params, AdminSetUserTokenStatus)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		stored, err := model.GetTokenById(tokenID)
		require.NoError(t, err)
		assert.Equal(t, common.TokenStatusDisabled, stored.Status)

		// 过期与耗尽由用量推导，不接受手动设置。
		response = adminUserRequest(http.MethodPost, "/api/user/:id/tokens/:token_id/status", `{"status":3}`, "", identity, common.RoleAdminUser, params, AdminSetUserTokenStatus)
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.False(t, result.Success)
		stored, err = model.GetTokenById(tokenID)
		require.NoError(t, err)
		assert.Equal(t, common.TokenStatusDisabled, stored.Status)

		response = adminUserRequest(http.MethodPost, "/api/user/:id/tokens/:token_id/status", `{"status":1}`, "", identity, common.RoleAdminUser, params, AdminSetUserTokenStatus)
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		stored, err = model.GetTokenById(tokenID)
		require.NoError(t, err)
		assert.Equal(t, common.TokenStatusEnabled, stored.Status)
	})

	t.Run("reading the full key needs its own proof", func(t *testing.T) {
		proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
			Scope:   service.VerificationScopeAdminUserManage,
			Context: fmt.Appendf(nil, `{"user_id":%d,"action":"token_key_read"}`, target.Id),
		}, service.VerificationMethodPassword)
		response := adminUserRequest(http.MethodGet, "/api/user/:id/tokens/:token_id/key", "", proof, identity, common.RoleAdminUser, params, AdminGetUserTokenKey)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		var payload struct {
			Key string `json:"key"`
		}
		require.NoError(t, common.Unmarshal(result.Data, &payload))
		assert.Equal(t, managedTokenSecret, payload.Key)
		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.token_key_view").Last(&audit).Error)
		require.NotNil(t, audit.Other.Op)
		assert.NotContains(t, response.Body.String(), proof)
	})

	t.Run("deleting a key needs the delete proof", func(t *testing.T) {
		// 读取明文的凭证不能拿来删除：动作必须一致。
		readProof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
			Scope:   service.VerificationScopeAdminUserManage,
			Context: fmt.Appendf(nil, `{"user_id":%d,"action":"token_key_read"}`, target.Id),
		}, service.VerificationMethodPassword)
		response := adminUserRequest(http.MethodDelete, "/api/user/:id/tokens/:token_id", "", readProof, identity, common.RoleAdminUser, params, AdminDeleteUserToken)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.Equal(t, "SECURITY_PROOF_CONTEXT_MISMATCH", result.Code)
		var count int64
		require.NoError(t, model.DB.Model(&model.Token{}).Where("user_id = ?", target.Id).Count(&count).Error)
		assert.EqualValues(t, 1, count)

		deleteProof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
			Scope:   service.VerificationScopeAdminUserManage,
			Context: fmt.Appendf(nil, `{"user_id":%d,"action":"token_delete"}`, target.Id),
		}, service.VerificationMethodPassword)
		response = adminUserRequest(http.MethodDelete, "/api/user/:id/tokens/:token_id", "", deleteProof, identity, common.RoleAdminUser, params, AdminDeleteUserToken)
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		require.NoError(t, model.DB.Model(&model.Token{}).Where("user_id = ?", target.Id).Count(&count).Error)
		assert.Zero(t, count)
		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.token_delete").Last(&audit).Error)
		require.NotNil(t, audit.Other.Op)
	})

	t.Run("the key of another user is unreachable", func(t *testing.T) {
		other := &model.User{Username: "other-key-owner", Password: target.Password, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "other-aff"}
		require.NoError(t, model.DB.Create(other).Error)
		require.NoError(t, model.DB.Create(&model.Token{UserId: other.Id, Key: "other-token-secret", Name: "other-key", Status: common.TokenStatusEnabled, Group: "default"}).Error)
		otherTokenID := managedTokenID(t, other.Id)
		foreign := gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "token_id", Value: fmt.Sprint(otherTokenID)}}
		response := adminUserRequest(http.MethodPost, "/api/user/:id/tokens/:token_id/status", `{"status":2}`, "", identity, common.RoleAdminUser, foreign, AdminSetUserTokenStatus)
		var result securityEnrollmentResponse
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.False(t, result.Success)
		stored, err := model.GetTokenById(otherTokenID)
		require.NoError(t, err)
		assert.Equal(t, common.TokenStatusEnabled, stored.Status)
	})
}
