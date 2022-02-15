class BadgeUtil {
    static async showTrackingBadgeAsync() {
        await chrome.action.setBadgeBackgroundColor({ color: '#008000' });
        await chrome.action.setBadgeText({ text: '...' });
    }

    static async hideTrackingBadgeAsync() {
        await chrome.action.setBadgeText({ text: '' });
    }
}

export default BadgeUtil;