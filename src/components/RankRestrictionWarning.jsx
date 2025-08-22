import React from 'react';
import { useUserSession } from '../hooks/useUserSession.js';
import { UserService } from '../services/userService.js';

/**
 * Component to display rank restriction warnings when user doesn't have sufficient permissions
 */
const RankRestrictionWarning = () => {
  const { userInfo, isLoading } = useUserSession();

  // Don't show anything while loading
  if (isLoading) {
    return null;
  }

  // Check if user can upload
  const uploadPermission = userInfo ? UserService.canUserUpload(userInfo) : null;

  // Don't show if user can upload or not logged in
  if (!userInfo || !uploadPermission || uploadPermission.canUpload) {
    return null;
  }

  const rankValidation = uploadPermission.rankValidation;
  const isForbiddenRank = rankValidation?.forbiddenRank;
  const currentRank = UserService.getUserRank(userInfo);
  const userRanks = UserService.getUserRanks(userInfo);

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 shadow-lg z-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            <svg className="h-6 w-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              {isForbiddenRank ? '🚫 Account Restricted' : '⚠️ Insufficient Permissions'}
            </h3>
            <p className="text-red-100 mb-2 font-medium">
              {uploadPermission.reason}
            </p>
            
            <div className="text-sm text-red-200">
              <div className="mb-2">
                <span className="font-medium">Current Rank:</span> {currentRank}
              </div>
              
              {userRanks.length > 0 && (
                <div className="mb-2">
                  <span className="font-medium">All Ranks:</span> {userRanks.join(', ')}
                </div>
              )}
              
              {!isForbiddenRank && (
                <div className="mb-2">
                  <span className="font-medium">Required Ranks:</span> 
                  <div className="mt-1 text-xs">
                    super admin, translator, trusted member, administrator, moderator, 
                    gold member, platinum member, trusted, subtranslator, os legend, vip lifetime member
                  </div>
                </div>
              )}
              
              <div className="mt-3 p-2 bg-red-700 rounded text-xs">
                <p className="font-medium mb-1">💡 What you can do:</p>
                <ul className="list-disc list-inside space-y-1">
                  {isForbiddenRank ? (
                    <>
                      <li>Contact OpenSubtitles support to resolve account restrictions</li>
                      <li>Check your account status on the OpenSubtitles website</li>
                    </>
                  ) : (
                    <>
                      <li>Contact OpenSubtitles support to request rank upgrade</li>
                      <li>Contribute to the community to earn higher ranks</li>
                      <li>Check rank requirements on the OpenSubtitles website</li>
                    </>
                  )}
                  <li>You can still download subtitles even with restricted upload access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankRestrictionWarning;