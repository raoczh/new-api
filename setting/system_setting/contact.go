package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type ContactSettings struct {
	Email        string `json:"email"`
	WeChatQRCode string `json:"wechat_qrcode"`
	QQGroup      string `json:"qq_group"`
}

var defaultContactSettings = ContactSettings{
	Email:        "",
	WeChatQRCode: "",
	QQGroup:      "",
}

func init() {
	config.GlobalConfig.Register("contact", &defaultContactSettings)
}

func GetContactSettings() *ContactSettings {
	return &defaultContactSettings
}
