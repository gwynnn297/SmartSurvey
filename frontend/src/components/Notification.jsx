import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { teamManagementService } from '../services/teamManagementService';
import './Notification.css';

const Notification = ({ onInvitationUpdate }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const notificationRef = useRef(null);

    // Helper function to get processed invitations from localStorage
    const getProcessedInvitations = () => {
        try {
            const stored = localStorage.getItem('processedTeamInvitations');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };

    // Helper function to save processed invitation status to localStorage
    // Status: 'ACCEPTED' or 'REJECTED' (matching backend InvitationStatus enum)
    const saveProcessedInvitationStatus = (teamId, status) => {
        try {
            const processed = getProcessedInvitations();
            processed[teamId] = status; // 'ACCEPTED' or 'REJECTED'
            localStorage.setItem('processedTeamInvitations', JSON.stringify(processed));
            console.log(`[Notification] Saved invitation status for team ${teamId}: ${status}`);
        } catch (error) {
            console.error('Error saving processed invitation status:', error);
        }
    };

    // Helper function to remove processed invitation from localStorage (when new invitation is sent)
    const removeProcessedInvitation = (teamId) => {
        try {
            const processed = getProcessedInvitations();
            if (processed[teamId]) {
                delete processed[teamId];
                localStorage.setItem('processedTeamInvitations', JSON.stringify(processed));
                console.log(`[Notification] Removed processed invitation record for team ${teamId} - new invitation detected`);
            }
        } catch (error) {
            console.error('Error removing processed invitation:', error);
        }
    };

    // Load notifications
    const loadNotifications = async () => {
        try {
            setLoading(true);
            const [notificationsData, count] = await Promise.all([
                notificationService.getNotifications(),
                notificationService.getUnreadCount()
            ]);

            let notificationsList = Array.isArray(notificationsData) ? notificationsData : [];

            // Get processed invitations from localStorage (persists across page reloads)
            const processedInvitations = getProcessedInvitations();

            // Check invitation status from backend and sync with localStorage
            // If backend has PENDING invitation, it means a new invitation was sent - clear old status
            // If backend has ACCEPTED/REJECTED status, update localStorage to match
            for (const notif of notificationsList) {
                if (notif.type === 'TEAM_INVITATION' && notif.relatedEntityId) {
                    const teamId = String(notif.relatedEntityId);
                    // Check if we can get invitation status from notification or need to fetch
                    // For now, if we have a TEAM_INVITATION notification, it means status is PENDING
                    // So clear any old ACCEPTED/REJECTED status from localStorage
                    if (processedInvitations[teamId] && (processedInvitations[teamId] === 'ACCEPTED' || processedInvitations[teamId] === 'REJECTED')) {
                        // New invitation detected (PENDING), remove old status
                        removeProcessedInvitation(teamId);
                        delete processedInvitations[teamId];
                    }
                } else if (notif.type === 'TEAM_MEMBER_ADDED' && notif.relatedEntityId) {
                    // If there's a TEAM_MEMBER_ADDED notification, invitation was accepted
                    const teamId = String(notif.relatedEntityId);
                    if (!processedInvitations[teamId] || processedInvitations[teamId] !== 'ACCEPTED') {
                        // Update localStorage to match backend status
                        saveProcessedInvitationStatus(teamId, 'ACCEPTED');
                        processedInvitations[teamId] = 'ACCEPTED';
                    }
                }
            }

            // Use functional update to preserve locally updated notifications (accept/reject actions)
            setNotifications(prev => {
                // Preserve notifications that have been locally updated (accept/reject)
                const preservedNotifications = new Map();
                prev.forEach(notif => {
                    if ((notif.type === 'TEAM_MEMBER_ADDED' || notif.type === 'TEAM_INVITATION_REJECTED') && notif.relatedEntityId) {
                        const teamId = String(notif.relatedEntityId); // Normalize to string for consistency
                        preservedNotifications.set(teamId, notif);
                    }
                });

                // Filter out duplicate TEAM_INVITATION notifications for the same team
                // Also hide TEAM_INVITATION if there's a TEAM_MEMBER_ADDED for the same team (user already joined)
                const teamInvitationMap = new Map();
                const teamMemberAddedMap = new Map(); // Track TEAM_MEMBER_ADDED notifications by teamId
                const teamRejectedMap = new Map(); // Track TEAM_INVITATION_REJECTED notifications by teamId
                const filteredNotifications = [];

                // First pass: collect TEAM_INVITATION, TEAM_MEMBER_ADDED, and TEAM_INVITATION_REJECTED notifications
                for (const notif of notificationsList) {
                    if (notif.type === 'TEAM_INVITATION' && notif.relatedEntityId) {
                        const teamId = String(notif.relatedEntityId);

                        // Only show unread TEAM_INVITATION notifications (isRead = false)
                        // This ensures that after accept/reject, the notification won't show again after reload
                        if (notif.isRead) {
                            console.log(`[Notification] Skipping TEAM_INVITATION for team ${teamId} - already read`);
                            continue; // Skip read notifications
                        }

                        // Skip if this invitation was already processed (ACCEPTED/REJECTED) - check localStorage
                        // This is a backup check in case notification wasn't marked as read
                        const storedStatus = processedInvitations[teamId];
                        if (storedStatus === 'ACCEPTED' || storedStatus === 'REJECTED') {
                            console.log(`[Notification] Skipping TEAM_INVITATION for team ${teamId} - status is ${storedStatus}`);
                            continue; // Skip this invitation, it was already processed
                        }

                        // Skip if we have a preserved TEAM_MEMBER_ADDED or TEAM_INVITATION_REJECTED for this team
                        if (preservedNotifications.has(teamId)) {
                            const preserved = preservedNotifications.get(teamId);
                            if (preserved.type === 'TEAM_MEMBER_ADDED' || preserved.type === 'TEAM_INVITATION_REJECTED') {
                                continue; // Skip this invitation, we have a preserved updated notification
                            }
                        }

                        const existing = teamInvitationMap.get(teamId);

                        if (!existing) {
                            // First notification for this team
                            teamInvitationMap.set(teamId, notif);
                        } else {
                            // Already have a notification for this team
                            // Keep the unread one, or the most recent one if both are read/unread
                            if (!notif.isRead && existing.isRead) {
                                // New one is unread, existing is read - keep new one
                                teamInvitationMap.set(teamId, notif);
                            } else if (notif.isRead && !existing.isRead) {
                                // New one is read, existing is unread - keep existing
                                // Do nothing, keep existing
                            } else {
                                // Both have same read status - keep the most recent one
                                const notifDate = new Date(notif.createdAt);
                                const existingDate = new Date(existing.createdAt);
                                if (notifDate > existingDate) {
                                    teamInvitationMap.set(teamId, notif);
                                }
                            }
                        }
                    } else if (notif.type === 'TEAM_MEMBER_ADDED' && notif.relatedEntityId) {
                        // Track TEAM_MEMBER_ADDED notifications
                        const teamId = String(notif.relatedEntityId); // Normalize to string for consistency
                        // Use preserved version if available (has updated message)
                        const preserved = preservedNotifications.get(teamId);
                        const notifToUse = (preserved && preserved.type === 'TEAM_MEMBER_ADDED') ? preserved : notif;

                        const existing = teamMemberAddedMap.get(teamId);
                        if (!existing) {
                            teamMemberAddedMap.set(teamId, notifToUse);
                        } else {
                            // Prefer preserved version, otherwise keep the most recent one
                            if (preserved && preserved.type === 'TEAM_MEMBER_ADDED') {
                                teamMemberAddedMap.set(teamId, preserved);
                            } else {
                                const notifDate = new Date(notif.createdAt);
                                const existingDate = new Date(existing.createdAt);
                                if (notifDate > existingDate) {
                                    teamMemberAddedMap.set(teamId, notif);
                                }
                            }
                        }
                    } else if (notif.type === 'TEAM_INVITATION_REJECTED' && notif.relatedEntityId) {
                        // Track TEAM_INVITATION_REJECTED notifications
                        const teamId = String(notif.relatedEntityId); // Normalize to string for consistency
                        // Use preserved version if available (has updated message)
                        const preserved = preservedNotifications.get(teamId);
                        const notifToUse = (preserved && preserved.type === 'TEAM_INVITATION_REJECTED') ? preserved : notif;

                        const existing = teamRejectedMap.get(teamId);
                        if (!existing) {
                            teamRejectedMap.set(teamId, notifToUse);
                        } else {
                            // Prefer preserved version, otherwise keep the most recent one
                            if (preserved && preserved.type === 'TEAM_INVITATION_REJECTED') {
                                teamRejectedMap.set(teamId, preserved);
                            } else {
                                const notifDate = new Date(notif.createdAt);
                                const existingDate = new Date(existing.createdAt);
                                if (notifDate > existingDate) {
                                    teamRejectedMap.set(teamId, notif);
                                }
                            }
                        }
                    } else {
                        // Not a team-related notification, add directly
                        filteredNotifications.push(notif);
                    }
                }

                // Add filtered TEAM_INVITATION notifications (only if no TEAM_MEMBER_ADDED or TEAM_INVITATION_REJECTED for same team)
                // IMPORTANT: teamInvitationMap keys are already strings (from line 71), so use them directly
                for (const [teamId, notif] of teamInvitationMap.entries()) {
                    // teamId is already a string from the Map key

                    // Only show unread notifications (isRead = false)
                    // New invitations will have isRead = false, so they will be shown
                    if (notif.isRead) {
                        console.log(`[Notification] Filtering out TEAM_INVITATION for team ${teamId} - already read`);
                        continue; // Skip read notifications
                    }

                    // Skip if this invitation was already processed (ACCEPTED/REJECTED) - check localStorage
                    // This is a backup check in case notification wasn't marked as read
                    const storedStatus = processedInvitations[teamId];
                    if (storedStatus === 'ACCEPTED' || storedStatus === 'REJECTED') {
                        console.log(`[Notification] Filtering out TEAM_INVITATION for team ${teamId} - status is ${storedStatus}`);
                        continue; // Skip this invitation, it was already processed
                    }

                    // Don't show TEAM_INVITATION if there's a TEAM_MEMBER_ADDED or TEAM_INVITATION_REJECTED for this team
                    // teamMemberAddedMap and teamRejectedMap also use string keys, so direct lookup works
                    const memberAdded = teamMemberAddedMap.get(teamId);
                    const rejected = teamRejectedMap.get(teamId);

                    if (memberAdded || rejected) {
                        // User already joined or rejected, hide invitation
                        continue;
                    }

                    // No TEAM_MEMBER_ADDED or TEAM_INVITATION_REJECTED, show invitation
                    // This ensures all unread invitations from different teams are shown
                    filteredNotifications.push(notif);
                }

                // Add TEAM_MEMBER_ADDED notifications
                for (const notif of teamMemberAddedMap.values()) {
                    filteredNotifications.push(notif);
                }

                // Add TEAM_INVITATION_REJECTED notifications
                for (const notif of teamRejectedMap.values()) {
                    filteredNotifications.push(notif);
                }

                // Add any preserved notifications that weren't in backend response
                preservedNotifications.forEach((notif, teamId) => {
                    const exists = filteredNotifications.some(n =>
                        (n.type === notif.type && n.relatedEntityId === notif.relatedEntityId) ||
                        (n.notificationId && n.notificationId === notif.notificationId)
                    );
                    if (!exists) {
                        filteredNotifications.push(notif);
                    }
                });

                // Sort by createdAt descending (newest first)
                filteredNotifications.sort((a, b) => {
                    const dateA = new Date(a.createdAt);
                    const dateB = new Date(b.createdAt);
                    return dateB - dateA;
                });

                // Calculate unread count from filtered notifications (not from backend count)
                // This ensures the count matches the displayed notifications
                const filteredUnreadCount = filteredNotifications.filter(n => !n.isRead).length;

                setUnreadCount(filteredUnreadCount);
                return filteredNotifications;
            });
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load notifications on mount
    useEffect(() => {
        loadNotifications();
        // Refresh notifications every 30 seconds
        const interval = setInterval(loadNotifications, 30000);

        // Listen for custom event to reload notifications (e.g., after sending invitation)
        const handleReloadNotifications = () => {
            loadNotifications();
        };
        window.addEventListener('reloadNotifications', handleReloadNotifications);

        return () => {
            clearInterval(interval);
            window.removeEventListener('reloadNotifications', handleReloadNotifications);
        };
    }, []);

    // Mark notification as read
    const handleMarkAsRead = async (notificationId) => {
        try {
            await notificationService.markAsRead(notificationId);
            setNotifications(prev => prev.map(notif =>
                notif.notificationId === notificationId
                    ? { ...notif, isRead: true }
                    : notif
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all as read
    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    // Handle notification click
    const handleNotificationClick = async (notification) => {
        // Với TEAM_INVITATION chưa đọc, không cho phép click vào notification item
        // Chỉ cho phép click vào 2 nút Accept/Reject
        if (notification.type === 'TEAM_INVITATION' && !notification.isRead) {
            return; // Không làm gì cả, chỉ cho phép click vào 2 nút Accept/Reject
        }

        // Mark as read
        if (!notification.isRead) {
            await handleMarkAsRead(notification.notificationId);
        }

        // Navigate based on notification type
        if (notification.type === 'TEAM_INVITATION' && notification.relatedEntityId) {
            // For team invitations (đã đọc), navigate to team management
            navigate('/team-management');
            setShowModal(false);
        } else if (notification.relatedEntityType === 'surveys' && notification.relatedEntityId) {
            navigate(`/surveys/${notification.relatedEntityId}`);
            setShowModal(false);
        } else if (notification.relatedEntityType === 'teams' && notification.relatedEntityId) {
            navigate('/team-management');
            setShowModal(false);
        }
    };

    // Handle accept invitation (for TEAM_INVITATION type)
    const handleAcceptInvitation = async (e, notification) => {
        e.stopPropagation();
        try {
            // Backend stores teamId in relatedEntityId, but we need invitationId
            // So we need to fetch invitations and find the matching one
            const teamId = notification.relatedEntityId;
            if (!teamId) {
                alert('Không tìm thấy thông tin lời mời.');
                return;
            }

            // Get all pending invitations for current user
            const invitations = await teamManagementService.getMyInvitations();

            // Find the invitation for this team with PENDING status
            // Convert to number for comparison to handle both string and number types
            const invitation = invitations.find(
                inv => Number(inv.teamId) === Number(teamId) && inv.status === 'PENDING'
            );

            if (!invitation || !invitation.invitationId) {
                alert('Không tìm thấy lời mời hợp lệ.');
                return;
            }

            await teamManagementService.acceptInvitation(invitation.invitationId);

            // Mark notification as read in database
            try {
                await notificationService.markAsRead(notification.notificationId);
            } catch (error) {
                console.error('Error marking notification as read:', error);
                // Continue even if marking as read fails
            }

            // Save status to localStorage (ACCEPTED) - matches backend InvitationStatus.ACCEPTED
            // This persists across page reloads and prevents showing the invitation again
            const teamIdStr = String(teamId);
            saveProcessedInvitationStatus(teamIdStr, 'ACCEPTED');

            // Update notification in state to show success message and mark as read
            setNotifications(prev => prev.map(notif => {
                if (notif.notificationId === notification.notificationId) {
                    return {
                        ...notif,
                        title: 'Bạn đã tham gia team',
                        message: 'Bạn đã tham gia team ' + (invitation.teamName || '') + ' thành công.',
                        isRead: true, // Mark as read
                        type: 'TEAM_MEMBER_ADDED' // Change type to reflect accepted status
                    };
                }
                return notif;
            }));
            setUnreadCount(prev => Math.max(0, prev - 1));

            // Notify parent component to update teams list
            if (onInvitationUpdate) {
                onInvitationUpdate();
            }

            // Don't reload notifications immediately - let the interval handle it
            // This prevents the notification from flickering back to the original state
            // The filter logic will handle hiding old TEAM_INVITATION when TEAM_MEMBER_ADDED exists
        } catch (error) {
            console.error('Error accepting invitation:', error);
            alert(error.response?.data?.message || 'Không thể chấp nhận lời mời.');
        }
    };

    // Handle reject invitation
    const handleRejectInvitation = async (e, notification) => {
        e.stopPropagation();
        try {
            // Backend stores teamId in relatedEntityId, but we need invitationId
            // So we need to fetch invitations and find the matching one
            const teamId = notification.relatedEntityId;
            if (!teamId) {
                alert('Không tìm thấy thông tin lời mời.');
                return;
            }

            // Get all pending invitations for current user
            const invitations = await teamManagementService.getMyInvitations();

            // Find the invitation for this team with PENDING status
            // Convert to number for comparison to handle both string and number types
            const invitation = invitations.find(
                inv => Number(inv.teamId) === Number(teamId) && inv.status === 'PENDING'
            );

            if (!invitation || !invitation.invitationId) {
                alert('Không tìm thấy lời mời hợp lệ.');
                return;
            }

            await teamManagementService.rejectInvitation(invitation.invitationId);

            // Mark notification as read in database
            try {
                await notificationService.markAsRead(notification.notificationId);
            } catch (error) {
                console.error('Error marking notification as read:', error);
                // Continue even if marking as read fails
            }

            // Save status to localStorage (REJECTED) - matches backend InvitationStatus.REJECTED
            // This persists across page reloads and prevents showing the invitation again
            const teamIdStr = String(teamId);
            saveProcessedInvitationStatus(teamIdStr, 'REJECTED');

            // Update notification in state - mark as read and update message
            setNotifications(prev => prev.map(notif => {
                if (notif.notificationId === notification.notificationId) {
                    return {
                        ...notif,
                        title: 'Bạn đã từ chối tham gia team',
                        message: 'Bạn đã từ chối tham gia team ' + (invitation.teamName || '') + '.',
                        isRead: true, // Mark as read
                        type: 'TEAM_INVITATION_REJECTED' // Change type to reflect rejected status
                    };
                }
                return notif;
            }));
            setUnreadCount(prev => Math.max(0, prev - 1));

            // Don't reload immediately - let the interval handle it to avoid flickering
            // The notification will stay as "Bạn đã từ chối tham gia team"
        } catch (error) {
            console.error('Error rejecting invitation:', error);
            alert(error.response?.data?.message || 'Không thể từ chối lời mời.');
        }
    };

    // Get notification icon based on type
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'TEAM_INVITATION':
                return 'fa-solid fa-user-plus';
            case 'TEAM_INVITATION_REJECTED':
                return 'fa-solid fa-user-xmark';
            case 'SURVEY_SHARED':
                return 'fa-solid fa-share';
            case 'SURVEY_PERMISSION_CHANGED':
                return 'fa-solid fa-key';
            case 'NEW_RESPONSE':
                return 'fa-solid fa-comment-dots';
            case 'SURVEY_PUBLISHED':
                return 'fa-solid fa-bullhorn';
            case 'TEAM_MEMBER_ADDED':
            case 'TEAM_MEMBER_REMOVED':
            case 'TEAM_MEMBER_ROLE_CHANGED':
                return 'fa-solid fa-users';
            case 'TEAM_CREATED':
                return 'fa-solid fa-user-group';
            default:
                return 'fa-solid fa-bell';
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showModal && notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowModal(false);
            }
        };

        if (showModal) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showModal]);

    return (
        <div className="notification-container" ref={notificationRef}>
            <button
                className="notification-bell"
                onClick={() => setShowModal(!showModal)}
                aria-label="Thông báo"
            >
                <i className="fa-solid fa-bell"></i>
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {showModal && (
                <div className="notificationteam-modal">
                    <button
                        className="notificationteam-close"
                        onClick={() => setShowModal(false)}
                        aria-label="Đóng"
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                    <div className="notificationteam-header">
                        <h3>Thông báo</h3>
                        {unreadCount > 0 && (
                            <button
                                className="btn-mark-all-read"
                                onClick={handleMarkAllAsRead}
                                title="Đánh dấu tất cả đã đọc"
                            >
                                Đánh dấu tất cả đã đọc
                            </button>
                        )}

                    </div>
                    <div className="notificationteam-body">
                        {loading ? (
                            <div className="notificationteam-loading">
                                <p>Đang tải...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <p className="notificationteam-empty">Không có thông báo nào.</p>
                        ) : (
                            <div className="notifications-list">
                                {notifications.map((notification) => {
                                    // Với TEAM_INVITATION chưa đọc, không cho phép click vào notification item
                                    const isTeamInvitationUnread = notification.type === 'TEAM_INVITATION' && !notification.isRead;

                                    return (
                                        <div
                                            key={notification.notificationId}
                                            className={`notification-item ${!notification.isRead ? 'unread' : ''} ${isTeamInvitationUnread ? 'no-click' : ''}`}
                                            onClick={!isTeamInvitationUnread ? () => handleNotificationClick(notification) : undefined}
                                        >
                                            <div className="notification-icon">
                                                <i className={getNotificationIcon(notification.type)}></i>
                                            </div>
                                            <div className="notification-content">
                                                <div className="notification-title">{notification.title}</div>
                                                <div className="notification-message">{notification.message}</div>
                                                <div className="notification-time">{formatDate(notification.createdAt)}</div>
                                            </div>
                                            {notification.type === 'TEAM_INVITATION' && !notification.isRead && (
                                                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        className="btn-accept-small"
                                                        onClick={(e) => handleAcceptInvitation(e, notification)}
                                                        title="Chấp nhận"
                                                    >
                                                        <i className="fa-solid fa-check"></i>
                                                    </button>
                                                    <button
                                                        className="btn-reject-small"
                                                        onClick={(e) => handleRejectInvitation(e, notification)}
                                                        title="Từ chối"
                                                    >
                                                        <i className="fa-solid fa-times"></i>
                                                    </button>
                                                </div>
                                            )}
                                            {!notification.isRead && (
                                                <div className="notification-unread-dot"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notification;

